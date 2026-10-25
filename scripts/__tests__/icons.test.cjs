const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  OUTLINED,
  FILLED,
  absolutePoints,
  normalizePath,
  pathsOf,
  polygonToPath,
} = require('../generate-icons.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

/** @param {string} source @param {string} start @param {string} end */
function keysOf(source, start, end) {
  const block = source.split(start)[1].split(end)[0];
  return [...block.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map(m => m[1]).sort();
}

test('glyphs.ts está em dia com a lista de ícones do gerador', () => {
  const glyphs = read('src/components/ui/Icon/glyphs.ts');
  assert.deepEqual(
    keysOf(glyphs, 'export const OUTLINED_GLYPHS = {', '} as const;'),
    [...new Set(OUTLINED)].sort(),
  );
  assert.deepEqual(
    keysOf(glyphs, 'export const FILLED_GLYPHS', '};'),
    [...new Set(FILLED)].sort(),
  );
});

test('o logo AO gerado tem as mesmas formas do SVG original', () => {
  const svg = read('src/assets/AO_Logo.svg');
  const logo = read('src/components/ui/AoLogo/logoPaths.ts');
  const shapes = (svg.match(/<(path|polygon)\b/g) || []).length;
  const generated = (logo.match(/['"]M/g) || []).length;
  assert.ok(shapes > 0);
  assert.equal(generated, shapes);
});

test('o ícone adaptativo tem a camada temática com o logo AO inteiro', () => {
  const svg = read('src/assets/AO_Logo.svg');
  const monochrome = read(
    'android/app/src/main/res/drawable/ic_launcher_monochrome.xml',
  );
  const shapes = (svg.match(/<(path|polygon)\b/g) || []).length;
  assert.equal((monochrome.match(/<path\b/g) || []).length, shapes);
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const icon = read(`android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`);
    assert.match(
      icon,
      /<monochrome android:drawable="@drawable\/ic_launcher_monochrome"/,
    );
    assert.match(
      icon,
      /<foreground android:drawable="@drawable\/ic_launcher_foreground"/,
    );
  }
});

test('extrai caminhos e converte polígonos', () => {
  assert.equal(
    pathsOf(
      '<svg viewBox="0 -960 960 960"><path d="M1 2Z"/><path d="M3 4Z"/></svg>',
      'x',
    ),
    'M1 2Z M3 4Z',
  );
  assert.throws(() => pathsOf('<svg><circle r="1"/></svg>', 'x'));
  // sem viewBox nem largura/altura não dá para saber a escala: rejeita
  assert.throws(() => pathsOf('<svg><path d="M1 2Z"/></svg>', 'x'));
  assert.equal(polygonToPath('1,2 3,4 5,6 '), 'M1,2L3,4L5,6Z');
});

/** Pares `nome: 'caminho'` de um bloco de glyphs.ts. */
function glyphEntries(source, start, end) {
  const block = source.split(start)[1].split(end)[0];
  return [
    ...block.matchAll(/^\s+([a-z0-9_]+):\s*(['"])([^'"]*)\2,?\s*$/gm),
  ].map(m => [m[1], m[3]]);
}

test('todos os glifos cabem no viewBox comum 0 -960 960 960', () => {
  const glyphs = read('src/components/ui/Icon/glyphs.ts');
  assert.match(glyphs, /ICON_VIEWBOX = '0 -960 960 960'/);
  const entries = [
    ...glyphEntries(glyphs, 'export const OUTLINED_GLYPHS = {', '} as const;'),
    ...glyphEntries(glyphs, 'export const FILLED_GLYPHS', '};'),
  ];
  assert.equal(entries.length, new Set(OUTLINED).size + new Set(FILLED).size);
  const tolerance = 1;
  for (const [name, d] of entries) {
    const points = absolutePoints(d);
    assert.ok(points.length > 0, `${name}: caminho vazio`);
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    // todas as coordenadas absolutas dentro de [0, 960] × [-960, 0]
    assert.ok(
      minX >= -tolerance && maxX <= 960 + tolerance,
      `${name}: x fora do viewBox (${minX}…${maxX})`,
    );
    assert.ok(
      minY >= -960 - tolerance && maxY <= tolerance,
      `${name}: y fora do viewBox (${minY}…${maxY})`,
    );
    // um glifo em outra escala (ex.: 24×24) ficaria minúsculo
    assert.ok(
      Math.max(maxX - minX, maxY - minY) >= 240,
      `${name}: glifo pequeno demais para o viewBox (${maxX - minX}×${
        maxY - minY
      })`,
    );
  }
});

test('normaliza caminhos de viewBox 24×24 para o viewBox comum', () => {
  // svg sem viewBox, só largura e altura (como o auto_awesome do repositório)
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="m12 2 10 10H2Zm0 4v4h-2V6Z"/></svg>';
  const d = pathsOf(svg, 'x.svg');
  assert.equal(d, 'M480-880l400 400H80Zm0 160v160h-80V-720Z');
  assert.deepEqual(absolutePoints(d), [
    [480, -880],
    [880, -480],
    [80, -480],
    [480, -720],
    [480, -560],
    [400, -560],
    [400, -720],
  ]);
  // já no viewBox comum: não muda nada
  const native = 'M450-450H220v-60h230Z';
  assert.equal(
    pathsOf(`<svg viewBox="0 -960 960 960"><path d="${native}"/></svg>`, 'y'),
    native,
  );
  // arcos: raios escalam, sinalizadores compactos ("01") são lidos um a um
  assert.equal(
    normalizePath('M2 12a10 10 0 0120 0Z', [0, 0, 24, 24]),
    'M80-480a400 400 0 0 1 800 0Z',
  );
  assert.throws(() => normalizePath('M0 0Z', [0, 0, 24, 12]));
});
