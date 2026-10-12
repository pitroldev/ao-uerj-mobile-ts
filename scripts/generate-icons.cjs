#!/usr/bin/env node
/*
 * Gera os glifos do design system a partir dos SVGs oficiais do Material
 * Symbols Outlined (peso 300, tamanho óptico 24, Apache 2.0) e o desenho do
 * logo AO a partir de src/assets/AO_Logo.svg.
 *
 *   node scripts/generate-icons.cjs            baixa os ícones e reescreve tudo
 *   node scripts/generate-icons.cjs --logo     só reescreve o logo (offline)
 *
 * Saídas (não edite à mão):
 *   src/components/ui/Icon/glyphs.ts      caminhos dos ícones por nome
 *   src/components/ui/AoLogo/logoPaths.ts caminhos do logo AO (preenchimento único)
 *
 * Para acrescentar um ícone: inclua o nome em OUTLINED (e em FILLED se a
 * variante preenchida for usada, como no item ativo do menu lateral) e rode o
 * script. Os nomes seguem https://fonts.google.com/icons (Material Symbols).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GLYPHS_FILE = path.join(ROOT, 'src/components/ui/Icon/glyphs.ts');
const LOGO_SOURCE = path.join(ROOT, 'src/assets/AO_Logo.svg');
const LOGO_FILE = path.join(ROOT, 'src/components/ui/AoLogo/logoPaths.ts');
const BASE =
  'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web';

/** Todos os ícones usados pela referência V3 e pelas telas do app. */
const OUTLINED = [
  // referência V3 (estáticos e em dados/objetos do protótipo)
  'account_tree',
  'add',
  'apartment',
  'arrow_back',
  'arrow_forward',
  'auto_awesome',
  'badge',
  'block',
  'bug_report',
  'check',
  'check_circle',
  'chevron_right',
  'close',
  'cloud_off',
  'code',
  'dark_mode',
  'date_range',
  'delete_sweep',
  'edit_calendar',
  'error',
  'event_available',
  'event_busy',
  'event_upcoming',
  'expand_more',
  'filter_alt_off',
  'forum',
  'history',
  'history_edu',
  'home',
  'how_to_reg',
  'info',
  'light_mode',
  'lightbulb',
  'lock',
  'logout',
  'mail',
  'manage_search',
  'menu',
  'menu_open',
  'monitoring',
  'open_in_new',
  'person',
  'progress_activity',
  'public',
  'refresh',
  'remove',
  'restart_alt',
  'school',
  'search',
  'search_off',
  'send',
  'settings',
  'share',
  'star',
  'swap_vert',
  'sync',
  'sync_problem',
  'task_alt',
  'tune',
  'visibility',
  'visibility_off',
  'work',
  // complementares para as telas do app
  'add_circle',
  'arrow_downward',
  'arrow_drop_down',
  'arrow_upward',
  'bedtime',
  'calendar_month',
  'calendar_today',
  'campaign',
  'cancel',
  'chevron_left',
  'content_copy',
  'delete',
  'description',
  'do_not_disturb_on',
  'done_all',
  'download',
  'edit',
  'event',
  'expand_less',
  'filter_alt',
  'filter_list',
  'grid_view',
  'group',
  'groups',
  'help',
  'hourglass_empty',
  'image',
  'keyboard_arrow_down',
  'keyboard_arrow_up',
  'link',
  'location_on',
  'login',
  'meeting_room',
  'menu_book',
  'more_vert',
  'new_releases',
  'notifications',
  'person_search',
  'priority_high',
  'report',
  'schedule',
  'sentiment_dissatisfied',
  'sort',
  'sunny',
  'swap_horiz',
  'timer',
  'today',
  'touch_app',
  'trending_down',
  'trending_up',
  'view_agenda',
  'view_week',
  'warning',
  'wb_twilight',
  'wifi_off',
];

/** Ícones que também precisam da variante preenchida (FILL 1). */
const FILLED = [
  // item ativo do menu lateral
  'account_tree',
  'edit_calendar',
  'forum',
  'home',
  'info',
  'monitoring',
  'public',
  'search',
  'task_alt',
  'person_search',
  // estados e marcadores
  'cancel',
  'check_circle',
  'error',
  'lock',
  'star',
  'warning',
];

const pad = n => String(n).padStart(2, ' ');

async function fetchText(url, attempt = 1) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    if (attempt < 3) return fetchText(url, attempt + 1);
    throw new Error(`HTTP ${res.status} em ${url}`);
  }
  return res.text();
}

/* -------------------------------------------------- caminhos e viewBox */

/** viewBox de destino, comum a todos os glifos (ICON_VIEWBOX em glyphs.ts). */
const TARGET_VIEWBOX = [0, -960, 960, 960];

/** Quantidade de números por segmento de cada comando de caminho SVG. */
const ARITY = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * Lê um atributo `d` em comandos `{ cmd, args }`, um segmento por item
 * (repetições implícitas viram itens separados). Os sinalizadores do arco
 * (`A`) são lidos como um único dígito, como manda a gramática do SVG.
 */
function parsePath(d) {
  const out = [];
  let i = 0;
  let cmd = null;
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const num = () => {
    skip();
    const m = NUMBER.exec(d.slice(i));
    if (!m) throw new Error(`Número esperado em "${d.slice(i, i + 12)}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const flag = () => {
    skip();
    if (d[i] !== '0' && d[i] !== '1')
      throw new Error(`Sinalizador de arco inválido: "${d.slice(i, i + 12)}"`);
    return Number(d[i++]);
  };
  for (skip(); i < d.length; skip()) {
    if (/[a-zA-Z]/.test(d[i])) {
      cmd = d[i++];
      if (!(cmd.toUpperCase() in ARITY))
        throw new Error(`Comando de caminho desconhecido: ${cmd}`);
      if (cmd.toUpperCase() === 'Z') {
        out.push({ cmd, args: [] });
        continue;
      }
    } else if (cmd == null || cmd.toUpperCase() === 'Z') {
      throw new Error(`Caminho inválido perto de "${d.slice(i, i + 12)}"`);
    } else if (cmd === 'M') {
      cmd = 'L'; // pares extras depois de um M são linhas
    } else if (cmd === 'm') {
      cmd = 'l';
    }
    const upper = cmd.toUpperCase();
    const args =
      upper === 'A'
        ? [num(), num(), num(), flag(), flag(), num(), num()]
        : Array.from({ length: ARITY[upper] }, num);
    out.push({ cmd, args });
  }
  return out;
}

/** O primeiro `m` de um caminho é absoluto (regra do SVG). */
const isAbsolute = (cmd, index) =>
  cmd === cmd.toUpperCase() || (index === 0 && cmd === 'm');

function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

function serializePath(segments) {
  return segments
    .map(({ cmd, args }) => cmd + args.map(fmt).join(' '))
    .join('')
    .replace(/ -/g, '-');
}

/**
 * Leva um caminho de um viewBox qualquer para o viewBox comum (960 de lado,
 * origem em 0,-960). Coordenadas absolutas escalam e deslocam; relativas e
 * raios só escalam.
 */
function normalizePath(d, viewBox) {
  const [minX, minY, w, h] = viewBox;
  const [tx, ty, tw, th] = TARGET_VIEWBOX;
  if (minX === tx && minY === ty && w === tw && h === th) return d;
  if (w !== h) throw new Error(`viewBox não quadrado: ${viewBox.join(' ')}`);
  const k = tw / w;
  const X = x => (x - minX) * k + tx;
  const Y = y => (y - minY) * k + ty;
  const S = v => v * k;
  const segments = parsePath(d).map(({ cmd, args }, index) => {
    const abs = isAbsolute(cmd, index);
    const c = abs ? cmd.toUpperCase() : cmd;
    switch (c.toUpperCase()) {
      case 'Z':
        return { cmd: c, args };
      case 'H':
        return { cmd: c, args: [abs ? X(args[0]) : S(args[0])] };
      case 'V':
        return { cmd: c, args: [abs ? Y(args[0]) : S(args[0])] };
      case 'A': {
        const [rx, ry, rot, large, sweep, x, y] = args;
        const end = abs ? [X(x), Y(y)] : [S(x), S(y)];
        return { cmd: c, args: [S(rx), S(ry), rot, large, sweep, ...end] };
      }
      default:
        return {
          cmd: c,
          args: args.map((v, j) => (abs ? (j % 2 ? Y(v) : X(v)) : S(v))),
        };
    }
  });
  return serializePath(segments);
}

/**
 * Pontos absolutos (extremos e pontos de controle) de um caminho, para
 * conferir que o glifo cabe no viewBox comum.
 */
function absolutePoints(d) {
  const points = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  parsePath(d).forEach(({ cmd, args }, index) => {
    const upper = cmd.toUpperCase();
    const abs = isAbsolute(cmd, index);
    if (upper === 'Z') {
      x = startX;
      y = startY;
      return;
    }
    let pairs;
    if (upper === 'H') pairs = [[args[0], abs ? y : 0]];
    else if (upper === 'V') pairs = [[abs ? x : 0, args[0]]];
    else if (upper === 'A') pairs = [[args[5], args[6]]];
    else
      pairs = Array.from({ length: args.length / 2 }, (_, j) => [
        args[2 * j],
        args[2 * j + 1],
      ]);
    const baseX = x;
    const baseY = y;
    for (const [px, py] of pairs) {
      points.push(abs ? [px, py] : [baseX + px, baseY + py]);
    }
    [x, y] = points[points.length - 1];
    if (upper === 'M') {
      startX = x;
      startY = y;
    }
  });
  return points;
}

/** viewBox do SVG; sem o atributo, usa `0 0 largura altura`. */
function viewBoxOf(svg, source) {
  const vb = /\sviewBox="([^"]+)"/.exec(svg);
  if (vb) {
    const nums = vb[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (nums.length === 4 && nums.every(Number.isFinite)) return nums;
    throw new Error(`viewBox inválido em ${source}: ${vb[1]}`);
  }
  const w = /<svg[^>]*\swidth="([\d.]+)(?:px)?"/.exec(svg);
  const h = /<svg[^>]*\sheight="([\d.]+)(?:px)?"/.exec(svg);
  if (w && h) return [0, 0, Number(w[1]), Number(h[1])];
  throw new Error(`SVG sem viewBox nem largura/altura: ${source}`);
}

/**
 * Caminhos de um SVG do Material Symbols, já no viewBox comum. Alguns
 * arquivos do repositório (ex.: auto_awesome) vêm em 24×24 e sem viewBox:
 * sem a conversão o glifo some (fica com 2,5% do tamanho, fora da área
 * visível do viewBox `0 -960 960 960`).
 */
function pathsOf(svg, source) {
  const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
  if (!ds.length) throw new Error(`Nenhum <path> em ${source}`);
  if (/<(circle|rect|polygon|ellipse|line)\b/.test(svg))
    throw new Error(`Forma não suportada em ${source}`);
  const viewBox = viewBoxOf(svg, source);
  return ds.map(d => normalizePath(d, viewBox)).join(' ');
}

async function glyph(name, fill) {
  const file = `${name}_wght300${fill ? 'fill1' : ''}_24px.svg`;
  const url = `${BASE}/${name}/materialsymbolsoutlined/${file}`;
  const svg = await fetchText(url);
  if (svg == null) throw new Error(`Ícone inexistente: ${name} (${file})`);
  return pathsOf(svg, file);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

function format(source) {
  const prettier = require('prettier');
  const options = prettier.resolveConfig.sync(GLYPHS_FILE) || {};
  return prettier.format(source, { ...options, parser: 'typescript' });
}

function objectLiteral(entries) {
  return entries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
}

async function writeGlyphs() {
  const outlined = [...new Set(OUTLINED)].sort();
  const filled = [...new Set(FILLED)].sort();
  const unknownFill = filled.filter(n => !outlined.includes(n));
  if (unknownFill.length)
    throw new Error(`FILLED sem OUTLINED: ${unknownFill.join(', ')}`);

  console.log(
    `Baixando ${outlined.length} ícones + ${filled.length} preenchidos…`,
  );
  const o = await mapLimit(outlined, 8, async (n, i) => {
    const d = await glyph(n, false);
    console.log(`  ${pad(i + 1)} ${n}`);
    return [n, d];
  });
  const f = await mapLimit(filled, 8, async n => [n, await glyph(n, true)]);

  const source = `/* Gerado por scripts/generate-icons.cjs. Não edite à mão. */
/* Material Symbols Outlined, peso 300, tamanho óptico 24 (Apache License 2.0). */

/** viewBox comum a todos os glifos do Material Symbols. */
export const ICON_VIEWBOX = '0 -960 960 960';

export const OUTLINED_GLYPHS = {
${objectLiteral(o)}
} as const;

export type IconName = keyof typeof OUTLINED_GLYPHS;

/** Variantes preenchidas (FILL 1) disponíveis. */
export const FILLED_GLYPHS: Partial<Record<IconName, string>> = {
${objectLiteral(f)}
};
`;
  fs.writeFileSync(GLYPHS_FILE, format(source));
  console.log(`OK: ${path.relative(ROOT, GLYPHS_FILE)}`);
}

/* ---------------------------------------------------------------- logo AO */
function polygonToPath(points) {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const pairs = [];
  for (let i = 0; i + 1 < nums.length; i += 2)
    pairs.push(`${nums[i]},${nums[i + 1]}`);
  return `M${pairs.join('L')}Z`;
}

function writeLogo() {
  const svg = fs.readFileSync(LOGO_SOURCE, 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(svg)[1];
  const shapes = [];
  for (const m of svg.matchAll(/<(path|polygon)\b([^>]*)\/?>/g)) {
    const attrs = m[2];
    if (m[1] === 'path') {
      shapes.push(/\sd="([^"]+)"/.exec(attrs)[1].replace(/\s+/g, ' ').trim());
    } else {
      shapes.push(polygonToPath(/points="([^"]+)"/.exec(attrs)[1]));
    }
  }
  if (/<(circle|rect|ellipse|line|polyline)\b/.test(svg))
    throw new Error('Forma não suportada no logo AO');
  const source = `/* Gerado por scripts/generate-icons.cjs a partir de src/assets/AO_Logo.svg. Não edite à mão. */

export const AO_LOGO_VIEWBOX = ${JSON.stringify(viewBox)};

/** Formas do logo AO; todas usam o mesmo preenchimento (recolorível). */
export const AO_LOGO_PATHS: readonly string[] = ${JSON.stringify(shapes)};
`;
  fs.mkdirSync(path.dirname(LOGO_FILE), { recursive: true });
  fs.writeFileSync(LOGO_FILE, format(source));
  console.log(
    `OK: ${path.relative(ROOT, LOGO_FILE)} (${shapes.length} formas)`,
  );
}

async function main() {
  writeLogo();
  if (process.argv.includes('--logo')) return;
  await writeGlyphs();
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  OUTLINED,
  FILLED,
  TARGET_VIEWBOX,
  absolutePoints,
  normalizePath,
  parsePath,
  pathsOf,
  polygonToPath,
};
