#!/usr/bin/env node
/*
 * Gera os glifos do design system a partir dos SVGs oficiais do Material
 * Symbols Outlined (peso 300, tamanho óptico 24, Apache 2.0) e o desenho do
 * logo AO a partir de src/assets/AO_Logo.svg.
 * Licença dos ícones: licenses/Apache-2.0.txt; créditos: THIRD_PARTY_NOTICES.txt.
 *
 *   node scripts/generate-icons.cjs            baixa os ícones e reescreve tudo
 *   node scripts/generate-icons.cjs --logo     só reescreve o logo (offline)
 *
 * Saídas (não edite à mão):
 *   src/components/ui/Icon/glyphs.ts      caminhos dos ícones por nome
 *   src/components/ui/AoLogo/logoPaths.ts caminhos do logo AO (preenchimento único)
 *   android/app/src/main/res/drawable/ic_launcher_monochrome.xml
 *                                         logo AO do ícone temático (Material You)
 *   ios/AOUerjMobile/Images.xcassets/AppIcon.appiconset/AppIcon-1024-{dark,tinted}.png
 *                                         ícone escuro e tingido do iPhone (iOS 18)
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
const MONOCHROME_FILE = path.join(
  ROOT,
  'android/app/src/main/res/drawable/ic_launcher_monochrome.xml',
);
/** Camada de 108dp do ícone adaptativo; o logo cabe nos 66dp da zona segura. */
const ICON_CANVAS = 108;
const MONOCHROME_LOGO_WIDTH = 44;
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
  'qr_code_2',
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
  // Companhia agora (tipos de chamada e destinos da volta)
  'directions_bus',
  'directions_walk',
  'restaurant',
  'subway',
  'train',
  // Agora no campus (tipos de aviso, respostas, nível e conquistas)
  'bolt',
  'door_front',
  'elevator',
  'emoji_events',
  'flag',
  'near_me',
  'sentiment_satisfied',
  'thumb_up',
  'verified',
  'water_drop',
  'workspace_premium',
];

/** Ícones que também precisam da variante preenchida (FILL 1). */
const FILLED = [
  // item ativo do menu lateral
  'account_tree',
  'campaign',
  'edit_calendar',
  'forum',
  'home',
  'info',
  'monitoring',
  'public',
  'search',
  'task_alt',
  'person_search',
  'groups',
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
  const out = Array.from({ length: items.length });
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

async function format(source) {
  const prettier = require('prettier');
  const options = (await prettier.resolveConfig(GLYPHS_FILE)) || {};
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
/* SVGs do Google convertidos em constantes TypeScript pelo projeto AO UERJ. */
/* Licença: licenses/Apache-2.0.txt. Créditos: THIRD_PARTY_NOTICES.txt. */

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
  fs.writeFileSync(GLYPHS_FILE, await format(source));
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

async function writeLogo() {
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
  fs.writeFileSync(LOGO_FILE, await format(source));
  console.log(
    `OK: ${path.relative(ROOT, LOGO_FILE)} (${shapes.length} formas)`,
  );
  fs.writeFileSync(MONOCHROME_FILE, monochromeIcon(viewBox, shapes));
  console.log(`OK: ${path.relative(ROOT, MONOCHROME_FILE)}`);
  writeIosIconVariants(viewBox, shapes);
}

/** As formas do logo AO como `writeLogo` as lê (para os testes). */
function logoShapes() {
  const svg = fs.readFileSync(LOGO_SOURCE, 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(svg)[1];
  const shapes = [];
  for (const m of svg.matchAll(/<(path|polygon)\b([^>]*)\/?>/g)) {
    const attrs = m[2];
    shapes.push(
      m[1] === 'path'
        ? /\sd="([^"]+)"/.exec(attrs)[1].replace(/\s+/g, ' ').trim()
        : polygonToPath(/points="([^"]+)"/.exec(attrs)[1]),
    );
  }
  return { viewBox, shapes };
}

/**
 * O logo AO num vetor de 108dp, centralizado e com 44dp de largura, perto do
 * tamanho dos glifos dos outros ícones temáticos; a caixa (44 × 27dp) fica bem
 * dentro da zona segura de 66dp. O sistema pinta o branco com as cores do
 * tema; os vãos do selo deixam o fundo aparecer.
 */
function monochromeIcon(viewBox, shapes) {
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const scale = MONOCHROME_LOGO_WIDTH / width;
  const round = value => Number(value.toFixed(4));
  const left = round((ICON_CANVAS - width * scale) / 2);
  const top = round((ICON_CANVAS - height * scale) / 2);
  const paths = shapes
    .map(
      d => `    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="${d}" />`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por scripts/generate-icons.cjs a partir de src/assets/AO_Logo.svg. Não edite à mão.
     Camada monochrome do ícone adaptativo (ícone temático do Material You, Android 13+). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${ICON_CANVAS}dp"
    android:height="${ICON_CANVAS}dp"
    android:viewportWidth="${ICON_CANVAS}"
    android:viewportHeight="${ICON_CANVAS}">
  <group
      android:translateX="${left}"
      android:translateY="${top}"
      android:scaleX="${round(scale)}"
      android:scaleY="${round(scale)}">
${paths}
  </group>
</vector>
`;
}

/* -------------------------------------- ícone do iPhone: escuro e tingido */
/*
 * O iOS 18 troca o ícone pelo modo da tela de início: o claro de sempre
 * (AppIcon-1024.png, a arte azul), o escuro (o logo sobre fundo transparente:
 * o sistema põe o fundo escuro dele) e o tingido (em tons de cinza: o
 * sistema pinta com a cor que o aluno escolheu, pela luminância). O logo fica
 * no mesmo lugar e no mesmo tamanho do ícone claro (859 px, centralizado),
 * para não pular quando o modo muda. Rasterizado aqui mesmo, sem dependência:
 * o logo só usa linhas e curvas cúbicas.
 */
const IOS_ICON_DIR = path.join(
  ROOT,
  'ios/AOUerjMobile/Images.xcassets/AppIcon.appiconset',
);
const IOS_ICON_SIZE = 1024;
const IOS_LOGO_WIDTH = 859;
/** Linhas de amostra por pixel (o antisserrilhado vertical; o horizontal é exato). */
const SAMPLES = 8;
/** Segmentos por curva cúbica: no tamanho do ícone, a curva fica lisa. */
const CURVE_STEPS = 24;

/** Os contornos de um caminho do logo, em pontos do viewBox (M, L, H, V, C, S, Z). */
function subpathsOf(d) {
  const subpaths = [];
  let current = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let control = null;
  const moveTo = (nx, ny) => {
    current = [[nx, ny]];
    subpaths.push(current);
    startX = nx;
    startY = ny;
  };
  const lineTo = (nx, ny) => {
    if (!current) moveTo(x, y);
    current.push([nx, ny]);
  };
  const curveTo = (c1, c2, end) => {
    if (!current) moveTo(x, y);
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const e = t * t * t;
      current.push([
        a * x + b * c1[0] + c * c2[0] + e * end[0],
        a * y + b * c1[1] + c * c2[1] + e * end[1],
      ]);
    }
  };
  parsePath(d).forEach(({ cmd, args }, index) => {
    const upper = cmd.toUpperCase();
    const rel = !isAbsolute(cmd, index);
    const point = (px, py) => (rel ? [x + px, y + py] : [px, py]);
    switch (upper) {
      case 'M': {
        [x, y] = point(args[0], args[1]);
        moveTo(x, y);
        control = null;
        break;
      }
      case 'L':
      case 'H':
      case 'V': {
        if (upper === 'L') [x, y] = point(args[0], args[1]);
        else if (upper === 'H') x = rel ? x + args[0] : args[0];
        else y = rel ? y + args[0] : args[0];
        lineTo(x, y);
        control = null;
        break;
      }
      case 'C':
      case 'S': {
        const second = upper === 'C' ? 2 : 0;
        const c1 =
          upper === 'C'
            ? point(args[0], args[1])
            : control
              ? [2 * x - control[0], 2 * y - control[1]]
              : [x, y];
        const c2 = point(args[second], args[second + 1]);
        const end = point(args[second + 2], args[second + 3]);
        curveTo(c1, c2, end);
        control = c2;
        [x, y] = end;
        break;
      }
      case 'Z': {
        if (current) current.push([startX, startY]);
        x = startX;
        y = startY;
        current = null;
        control = null;
        break;
      }
      default:
        throw new Error(`Comando sem suporte no ícone do iPhone: ${cmd}`);
    }
  });
  return subpaths;
}

/**
 * A cobertura (0 a 1) de um caminho, pela regra nonzero do SVG, em
 * `size` × `size` pixels. Cada caminho é preenchido sozinho: os vãos do selo
 * são contornos ao contrário dentro do mesmo caminho.
 */
function pathCoverage(subpaths, size, toPixel) {
  const edges = [];
  for (const subpath of subpaths) {
    const points = subpath.map(toPixel);
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if (y0 !== y1) edges.push([x0, y0, x1, y1]);
    }
  }
  const cover = new Float64Array(size * size);
  const crossings = [];
  for (let row = 0; row < size; row++) {
    for (let sample = 0; sample < SAMPLES; sample++) {
      const sy = row + (sample + 0.5) / SAMPLES;
      crossings.length = 0;
      for (const [x0, y0, x1, y1] of edges) {
        if ((y0 <= sy && sy < y1) || (y1 <= sy && sy < y0))
          crossings.push([
            x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0),
            y1 > y0 ? 1 : -1,
          ]);
      }
      crossings.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      for (let i = 0; i < crossings.length - 1; i++) {
        winding += crossings[i][1];
        if (winding === 0) continue;
        const from = Math.max(0, crossings[i][0]);
        const to = Math.min(size, crossings[i + 1][0]);
        for (let px = Math.floor(from); px < to; px++) {
          const overlap = Math.min(to, px + 1) - Math.max(from, px);
          if (overlap > 0) cover[row * size + px] += overlap / SAMPLES;
        }
      }
    }
  }
  return cover;
}

/** A cobertura do logo inteiro: os caminhos somados como tinta sobre tinta. */
function logoCoverage(viewBox, shapes, size = IOS_ICON_SIZE) {
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
  const scale = IOS_LOGO_WIDTH / width;
  const left = (size - width * scale) / 2;
  const top = (size - height * scale) / 2;
  const toPixel = ([px, py]) => [
    left + (px - minX) * scale,
    top + (py - minY) * scale,
  ];
  const alpha = new Float64Array(size * size);
  for (const d of shapes) {
    const cover = pathCoverage(subpathsOf(d), size, toPixel);
    for (let i = 0; i < alpha.length; i++) {
      const a = Math.min(1, cover[i]);
      alpha[i] = alpha[i] + a * (1 - alpha[i]);
    }
  }
  return { alpha, top, height: height * scale };
}

/** Um PNG de 8 bits: RGB (`channels` 3) ou RGBA (4), sem entrelaçamento. */
function encodePng(size, channels, pixels) {
  const zlib = require('node:zlib');
  const stride = size * channels;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let row = 0; row < size; row++)
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * As duas variantes do iOS 18, do mesmo logo:
 * - escura: o logo de branco a azul-claro de cima para baixo (a profundidade
 *   que o ícone claro tem na sombra), sobre fundo transparente;
 * - tingida: o mesmo degradê em cinza (100% a 80%), sobre preto opaco.
 */
function iosIconVariants(viewBox, shapes) {
  const size = IOS_ICON_SIZE;
  const { alpha, top, height } = logoCoverage(viewBox, shapes, size);
  const dark = Buffer.alloc(size * size * 4);
  const tinted = Buffer.alloc(size * size * 3);
  // de #FFFFFF a #C9D9EC (o on-brand-muted do app), no alto do logo
  const from = [255, 255, 255];
  const to = [201, 217, 236];
  for (let row = 0; row < size; row++) {
    const t = Math.min(1, Math.max(0, (row - top) / height));
    const color = from.map((c, i) => Math.round(c + (to[i] - c) * t));
    const gray = 255 - 51 * t;
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      const a = alpha[i];
      dark.set([...color, Math.round(a * 255)], i * 4);
      const value = Math.round(gray * a);
      tinted.set([value, value, value], i * 3);
    }
  }
  return {
    dark: encodePng(size, 4, dark),
    tinted: encodePng(size, 3, tinted),
  };
}

function writeIosIconVariants(viewBox, shapes) {
  const { dark, tinted } = iosIconVariants(viewBox, shapes);
  for (const [name, png] of [
    ['AppIcon-1024-dark.png', dark],
    ['AppIcon-1024-tinted.png', tinted],
  ]) {
    fs.writeFileSync(path.join(IOS_ICON_DIR, name), png);
    console.log(`OK: ${path.relative(ROOT, path.join(IOS_ICON_DIR, name))}`);
  }
}

async function main() {
  await writeLogo();
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
  iosIconVariants,
  logoShapes,
  monochromeIcon,
  normalizePath,
  parsePath,
  pathsOf,
  polygonToPath,
};
