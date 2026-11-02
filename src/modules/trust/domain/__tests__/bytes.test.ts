import {
  ascii,
  bigIntToBytes,
  bytesToBigInt,
  concat,
  equalBytes,
  fromBase64,
  fromHex,
  toBase64,
  toHex,
  u16,
  u32,
} from '../bytes';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('base64', () => {
  it('matches the usual encoding, with and without the URL alphabet', () => {
    // os vetores da RFC 4648, 10
    const cases: [string, string][] = [
      ['', ''],
      ['f', 'Zg=='],
      ['fo', 'Zm8='],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg=='],
      ['fooba', 'Zm9vYmE='],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [text, encoded] of cases) {
      expect(toBase64(ascii(text))).toBe(encoded);
      expect(fromBase64(encoded)).toEqual(ascii(text));
    }
    const high = bytes(0xfb, 0xff, 0xbf);
    expect(toBase64(high)).toBe('+/+/');
    expect(toBase64(high, { url: true })).toBe('-_-_');
    expect(fromBase64('-_-_')).toEqual(high);
    expect(fromBase64('+/+/')).toEqual(high);
  });

  it('reads input without padding and refuses what is not base64', () => {
    expect(fromBase64('Zm9vYg')).toEqual(ascii('foob'));
    expect(fromBase64('Zm9vYmE')).toEqual(ascii('fooba'));
    for (const invalid of ['Z', 'Zm9v Yg==', 'Zm=9', 'Zm9vY===', 'ção'])
      expect(fromBase64(invalid)).toBeNull();
  });

  it('round-trips every byte value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    for (let length = 0; length <= 6; length++) {
      const part = all.subarray(250 - length, 250);
      expect(fromBase64(toBase64(part, { url: true }))).toEqual(part);
    }
    expect(fromBase64(toBase64(all))).toEqual(all);
  });
});

describe('integers and helpers', () => {
  it('converts big integers to fixed-size big-endian bytes and back', () => {
    expect(bytesToBigInt(new Uint8Array(0))).toBe(0n);
    expect(bytesToBigInt(bytes(1, 0))).toBe(256n);
    expect(bigIntToBytes(256n, 4)).toEqual(bytes(0, 0, 1, 0));
    expect(() => bigIntToBytes(65536n, 2)).toThrow(RangeError);
    expect(() => bigIntToBytes(-1n, 2)).toThrow(RangeError);
  });

  it('writes hex, lengths and ASCII as the protocol expects', () => {
    expect(toHex(bytes(0, 15, 255))).toBe('000fff');
    expect(fromHex('000FfF')).toEqual(bytes(0, 15, 255));
    expect(() => fromHex('abc')).toThrow(RangeError);
    expect(u16(0x0102)).toEqual(bytes(1, 2));
    expect(u32(0x01020304)).toEqual(bytes(1, 2, 3, 4));
    expect(concat(bytes(1), bytes(), bytes(2, 3))).toEqual(bytes(1, 2, 3));
    expect(equalBytes(bytes(1, 2), bytes(1, 2))).toBe(true);
    expect(equalBytes(bytes(1, 2), bytes(1, 3))).toBe(false);
    expect(equalBytes(bytes(1), bytes(1, 2))).toBe(false);
    expect(() => ascii('não')).toThrow(RangeError);
  });
});
