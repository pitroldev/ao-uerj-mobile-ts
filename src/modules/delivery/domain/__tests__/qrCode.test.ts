/* oxlint-disable no-bitwise -- O FNV-1a e a leitura dos bits do formato, como no codificador. */
import { inviteLink } from '../invite';
import { encodeQr, formatBits, qrPath, type QrMatrix } from '../qrCode';

/** FNV-1a de 32 bits das linhas, para guardar um QR inteiro numa constante. */
function fingerprint({ modules }: QrMatrix): string {
  const text = modules
    .map(row => row.map(dark => (dark ? '1' : '0')).join(''))
    .join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

/** A marca de canto 7×7: anel escuro, anel claro e o miolo 3×3. */
function hasFinder({ modules }: QrMatrix, top: number, left: number): boolean {
  for (let y = 0; y < 7; y += 1)
    for (let x = 0; x < 7; x += 1) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      if (modules[top + y][left + x] !== (ring !== 2)) return false;
    }
  return true;
}

/** Os 15 bits do formato lidos da primeira cópia, ao redor do canto de cima. */
function readFormat({ modules }: QrMatrix): number {
  const bits: boolean[] = [];
  for (let i = 0; i <= 5; i += 1) bits[i] = modules[i][8];
  bits[6] = modules[7][8];
  bits[7] = modules[8][8];
  bits[8] = modules[8][7];
  for (let i = 9; i < 15; i += 1) bits[i] = modules[8][14 - i];
  return bits.reduce((value, dark, i) => value | (Number(dark) << i), 0);
}

// As impressões abaixo são de matrizes que o leitor do OpenCV
// (cv2.QRCodeDetector) decodificou de volta no texto, em 04/11/2026, com as
// versões 1 a 10, acentos e as oito máscaras.
it('encodes the invite link in a version 6 code the readers decode', () => {
  const qr = encodeQr(inviteLink('qr'));
  expect(qr.size).toBe(41);
  expect(fingerprint(qr)).toBe('24e7069a');
});

it('keeps a short text in the smallest version', () => {
  const qr = encodeQr('AO UERJ');
  expect(qr.size).toBe(21);
  expect(fingerprint(qr)).toBe('132a4115');
});

it('draws the three finder patterns, the timing lines and the dark module', () => {
  const qr = encodeQr(inviteLink('menu'));
  const last = qr.size - 7;
  expect(hasFinder(qr, 0, 0)).toBe(true);
  expect(hasFinder(qr, 0, last)).toBe(true);
  expect(hasFinder(qr, last, 0)).toBe(true);
  for (let i = 8; i < qr.size - 8; i += 1) {
    expect(qr.modules[6][i]).toBe(i % 2 === 0);
    expect(qr.modules[i][6]).toBe(i % 2 === 0);
  }
  expect(qr.modules[qr.size - 8][8]).toBe(true);
});

it('writes the level M format with the mask it chose, or the one asked for', () => {
  const chosen = readFormat(encodeQr(inviteLink('qr')));
  expect(Array.from({ length: 8 }, (_, mask) => formatBits(mask))).toContain(
    chosen,
  );
  for (let mask = 0; mask < 8; mask += 1)
    expect(readFormat(encodeQr('AO UERJ', { mask }))).toBe(formatBits(mask));
});

it('grows with the text and refuses what does not fit in version 10', () => {
  expect(encodeQr('x'.repeat(213)).size).toBe(57);
  expect(() => encodeQr('x'.repeat(214))).toThrow(RangeError);
  // 2 bytes por letra acentuada em UTF-8; a versão 1 (nível M) leva 14
  expect(encodeQr('é'.repeat(7)).size).toBe(21);
  expect(encodeQr('é'.repeat(8)).size).toBe(25);
});

it('turns the dark modules into one rectangle per run', () => {
  const qr: QrMatrix = {
    size: 3,
    modules: [
      [true, true, false],
      [false, false, false],
      [true, false, true],
    ],
  };
  expect(qrPath(qr)).toBe('M0 0h2v1h-2zM0 2h1v1h-1zM2 2h1v1h-1z');
});
