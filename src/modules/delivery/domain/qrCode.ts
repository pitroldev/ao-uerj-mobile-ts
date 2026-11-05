/**
 * QR Code (ISO/IEC 18004) para textos curtos, como o link do convite: modo
 * byte (UTF-8), correção nível M (15%), versões 1 a 10 e a máscara de menor
 * penalidade. Sem dependência: o app só desenha um link de algumas dezenas de
 * caracteres.
 */
/* oxlint-disable no-bitwise -- A norma é feita de bits: Reed-Solomon em GF(256), os códigos BCH do formato e da versão e a leitura dos bytes bit a bit. */

/** `modules[y][x]`: `true` é escuro. Sem a margem branca, que quem desenha põe. */
export type QrMatrix = { size: number; modules: boolean[][] };

const MAX_VERSION = 10;
/** Nível M, versões 1 a 10: códigos de correção por bloco e número de blocos. */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Os dois bits do nível M no código de formato. */
const LEVEL_M_BITS = 0b00;

function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return bytes;
}

/** Módulos que levam dados e correção (fora padrões, formato e versão). */
function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const totalCodewords = (version: number) => Math.floor(rawModules(version) / 8);
const dataCodewords = (version: number) =>
  totalCodewords(version) - ECC_PER_BLOCK[version - 1] * BLOCKS[version - 1];

/* ------------------------------------------------- Reed-Solomon, GF(256) */

function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function divisor(degree: number): number[] {
  const result = Array.from({ length: degree }, () => 0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
}

function remainder(data: readonly number[], by: readonly number[]): number[] {
  const result = by.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    by.forEach((coefficient, i) => {
      result[i] ^= multiply(coefficient, factor);
    });
  }
  return result;
}

/** Divide os dados em blocos, calcula a correção de cada um e intercala. */
function withCorrection(data: readonly number[], version: number): number[] {
  const blocks = BLOCKS[version - 1];
  const ecc = ECC_PER_BLOCK[version - 1];
  const total = totalCodewords(version);
  const shortBlocks = blocks - (total % blocks);
  const shortLength = Math.floor(total / blocks);
  const by = divisor(ecc);
  const parts: number[][] = [];
  for (let i = 0, start = 0; i < blocks; i += 1) {
    const length = shortLength - ecc + (i < shortBlocks ? 0 : 1);
    const chunk = data.slice(start, start + length);
    start += length;
    // os blocos curtos ganham um byte vazio para alinhar a intercalação
    parts.push([
      ...chunk,
      ...(i < shortBlocks ? [0] : []),
      ...remainder(chunk, by),
    ]);
  }
  const result: number[] = [];
  for (let i = 0; i < parts[0].length; i += 1)
    parts.forEach((block, j) => {
      if (i !== shortLength - ecc || j >= shortBlocks) result.push(block[i]);
    });
  return result;
}

/* ------------------------------------------------- desenho */

type Grid = boolean[][];

const grid = (size: number): Grid =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => false));

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < count; position -= step)
    result.splice(1, 0, position);
  return result;
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Os 15 bits do formato: nível e máscara, com correção BCH e a máscara fixa. */
export function formatBits(mask: number): number {
  const data = (LEVEL_M_BITS << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  return ((data << 10) | (rest & 0x3ff)) ^ 0x5412;
}

function drawFormat(modules: Grid, size: number, mask: number) {
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = bit(i);
  // o módulo escuro fixo
  modules[size - 8][8] = true;
}

/** Penalidade da norma: sequências, blocos 2×2, padrões de canto e equilíbrio. */
function penalty(modules: Grid, size: number): number {
  let score = 0;
  const line = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i += 1) {
      let run = 1;
      for (let j = 1; j <= size; j += 1) {
        if (j < size && get(i, j) === get(i, j - 1)) run += 1;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      for (let j = 0; j + 10 < size; j += 1) {
        const pattern = Array.from({ length: 11 }, (_, k) => get(i, j + k));
        const finder = [true, false, true, true, true, false, true];
        const light = [false, false, false, false];
        const matches = (expected: boolean[]) =>
          expected.every((value, k) => pattern[k] === value);
        if (matches([...finder, ...light]) || matches([...light, ...finder]))
          score += 40;
      }
    }
  };
  line((y, x) => modules[y][x]);
  line((x, y) => modules[y][x]);
  let dark = 0;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
      if (
        x + 1 < size &&
        y + 1 < size &&
        modules[y][x] === modules[y][x + 1] &&
        modules[y][x] === modules[y + 1][x] &&
        modules[y][x] === modules[y + 1][x + 1]
      )
        score += 3;
    }
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/**
 * Os módulos escuros como um caminho SVG (um retângulo por sequência na
 * linha), nas coordenadas dos módulos: a margem fica com quem desenha.
 */
export function qrPath({ size, modules }: QrMatrix): string {
  const parts: string[] = [];
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      let run = 1;
      while (x + run < size && modules[y][x + run]) run += 1;
      parts.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run - 1;
    }
  return parts.join('');
}

/**
 * O QR do texto, na menor versão em que cabe. Texto longo demais para a
 * versão 10 (até 213 bytes em UTF-8) é um erro de quem chama. `mask` fixa a
 * máscara (0 a 7) no lugar da de menor penalidade.
 */
export function encodeQr(
  text: string,
  { mask: fixedMask }: { mask?: number } = {},
): QrMatrix {
  const bytes = utf8(text);
  let version = 1;
  while (
    version <= MAX_VERSION &&
    4 + (version < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(version) * 8
  )
    version += 1;
  if (version > MAX_VERSION)
    throw new RangeError('Texto longo demais para o QR');

  // modo byte, tamanho, os bytes, terminador e preenchimento
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach(byte => push(byte, 8));
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  const codewords = withCorrection(data, version);

  const size = version * 4 + 17;
  const modules = grid(size);
  const reserved = grid(size);
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  // linhas de tempo, marcas de canto e de alinhamento
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size)
          set(x, y, distance !== 2 && distance !== 4);
      }
  const positions = alignmentPositions(version, size);
  const last = positions.length - 1;
  positions.forEach((py, i) =>
    positions.forEach((px, j) => {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0)
      )
        return;
      for (let dy = -2; dy <= 2; dy += 1)
        for (let dx = -2; dx <= 2; dx += 1)
          set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  // o lugar do formato fica reservado; os bits entram com a máscara
  drawFormat(modules, size, 0);
  for (let i = 0; i < 9; i += 1) {
    reserved[i][8] = true;
    reserved[8][i] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  if (version >= 7) {
    let rest = version;
    for (let i = 0; i < 12; i += 1)
      rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
    const versionBits = (version << 12) | (rest & 0xfff);
    for (let i = 0; i < 18; i += 1) {
      const dark = ((versionBits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // os dados em zigue-zague, de baixo para cima, em colunas de dois
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1)
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!reserved[y][x] && index < codewords.length * 8) {
          modules[y][x] =
            ((codewords[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0;
          index += 1;
        }
      }
  }

  // a máscara de menor penalidade
  let best: Grid = modules;
  let bestScore = Infinity;
  MASKS.forEach((mask, number) => {
    if (fixedMask !== undefined && fixedMask !== number) return;
    const candidate = modules.map((row, y) =>
      row.map((dark, x) => (reserved[y][x] ? dark : dark !== mask(x, y))),
    );
    drawFormat(candidate, size, number);
    const score = penalty(candidate, size);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return { size, modules: best };
}
