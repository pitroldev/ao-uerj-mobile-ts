#!/usr/bin/env node
/*
 * Captura telas dos protótipos em tamanho de celular (412 px de largura).
 *
 * O Chrome headless no Windows não abre janelas com menos de ~500 px, então a
 * página é carregada num iframe de 412 px dentro de uma janela maior e o PNG é
 * recortado com ffmpeg.
 *
 * Uso:
 *   node docs/design-proposals/tools/shoot.cjs <arquivo.html> <pasta-saida> <nome>=<rota> [<nome>=<rota> ...]
 *   node docs/design-proposals/tools/shoot.cjs v1.html out home-light="home?theme=light" home-dark="home?theme=dark"
 *
 * Rotas recebem `capture=1` automaticamente. Opções por item: sufixo `@412x1600`
 * define o tamanho (padrão 412x892), ex.: home-long="home?theme=light@412x1600".
 * Use `desktop` como rota especial `desktop:<rota>` para capturar a moldura em 1440x900.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

function fileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/');
}

function shoot(htmlFile, outDir, name, spec) {
  let route = spec;
  let w = 412;
  let h = 892;
  const size = /@(\d+)x(\d+)$/.exec(route);
  if (size) {
    w = Number(size[1]);
    h = Number(size[2]);
    route = route.slice(0, size.index);
  }
  const desktop = route.startsWith('desktop:');
  if (desktop) {
    route = route.slice('desktop:'.length);
    w = 1440;
    h = 900;
  }
  route = route.replace(/^#?\/?/, '');
  const sep = route.includes('?') ? '&' : '?';
  const target = `${fileUrl(htmlFile)}#/${route}${sep}capture=1`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-shot-'));
  const raw = path.join(profile, 'raw.png');
  const out = path.join(outDir, `${name}.png`);

  let pageUrl = target;
  let winW = w;
  if (!desktop && w < 600) {
    const wrapper = path.join(profile, 'wrap.html');
    fs.writeFileSync(
      wrapper,
      `<!doctype html><html><body style="margin:0;background:#000">` +
        `<iframe src="${target}" style="border:0;display:block;width:${w}px;height:${h}px"></iframe>` +
        `</body></html>`,
    );
    pageUrl = fileUrl(wrapper);
    winW = 600;
  }

  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      `--window-size=${winW},${h}`,
      '--virtual-time-budget=6000',
      `--screenshot=${raw}`,
      pageUrl,
    ],
    { stdio: 'ignore', timeout: 90000 },
  );

  if (winW !== w) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `crop=${w}:${h}:0:0`, out]);
  } else {
    fs.copyFileSync(raw, out);
  }
  fs.rmSync(profile, { recursive: true, force: true });
  return out;
}

function main() {
  const [htmlFile, outDir, ...items] = process.argv.slice(2);
  if (!htmlFile || !outDir || items.length === 0) {
    console.error('uso: shoot.cjs <arquivo.html> <pasta-saida> <nome>=<rota> ...');
    process.exit(2);
  }
  if (!CHROME) {
    console.error('Chrome/Edge não encontrado.');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const item of items) {
    const eq = item.indexOf('=');
    const name = item.slice(0, eq);
    const spec = item.slice(eq + 1);
    try {
      console.log(shoot(htmlFile, outDir, name, spec));
    } catch (error) {
      console.error(`falhou: ${name} (${error.message})`);
    }
  }
}

main();
