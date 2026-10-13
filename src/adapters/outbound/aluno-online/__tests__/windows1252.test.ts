import { decodeWindows1252 } from '../windows1252';

const decode = (...bytes: number[]) => decodeWindows1252(new Uint8Array(bytes));

it('decodes Portuguese accents as Latin-1', () => {
  expect(decode(0x61, 0xe7, 0xe3, 0x6f)).toBe('ação');
  expect(decode(0xc9, 0x20, 0xea, 0x20, 0xfa, 0x20, 0xaa)).toBe('É ê ú ª');
});

it('keeps ASCII and the 0xA0–0xFF range unchanged', () => {
  const bytes = [
    ...Array.from({ length: 0x80 }, (_, i) => i),
    ...Array.from({ length: 0x60 }, (_, i) => 0xa0 + i),
  ];
  expect(decode(...bytes)).toBe(String.fromCharCode(...bytes));
});

it('maps 0x80–0x9F to the windows-1252 punctuation instead of C1 controls', () => {
  expect(decode(0x93, 0x41, 0x94, 0x20, 0x96, 0x20, 0x97, 0x20, 0x80)).toBe(
    '“A” – — €',
  );
  expect(decode(0x85, 0x91, 0x92, 0x99, 0x8a, 0x9f)).toBe('…‘’™ŠŸ');
});

it('keeps the bytes without a windows-1252 character as C1 controls', () => {
  expect(decode(0x81, 0x8d, 0x8f, 0x90, 0x9d)).toBe(
    '\u0081\u008d\u008f\u0090\u009d',
  );
});

it('decodes an empty body', () => {
  expect(decode()).toBe('');
});

it('decodes pages larger than one chunk without losing characters', () => {
  const bytes = new Uint8Array(20_001).map((_, i) => (i % 2 ? 0x93 : 0xe7));
  const text = decodeWindows1252(bytes);
  expect(text).toHaveLength(bytes.length);
  expect(text.slice(8190, 8194)).toBe('ç“ç“');
  expect(text.endsWith('ç“ç')).toBe(true);
});
