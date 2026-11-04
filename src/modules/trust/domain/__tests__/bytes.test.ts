import {
  ascii,
  concat,
  fromBase64,
  toBase64,
  toHex,
  u16,
  utf8,
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

describe('helpers', () => {
  it('writes hex, lengths, ASCII and UTF-8 as the session request expects', () => {
    expect(toHex(bytes(0, 15, 255))).toBe('000fff');
    expect(u16(0x0102)).toEqual(bytes(1, 2));
    expect(concat(bytes(1), bytes(), bytes(2, 3))).toEqual(bytes(1, 2, 3));
    expect(() => ascii('não')).toThrow(RangeError);
    // o mesmo que o Buffer do servidor: 1, 2, 3 e 4 bytes por caractere
    const cases: [string, number[]][] = [
      ['A', [0x41]],
      ['JOÃO', [0x4a, 0x4f, 0xc3, 0x83, 0x4f]],
      ['€', [0xe2, 0x82, 0xac]],
      ['𝄞', [0xf0, 0x9d, 0x84, 0x9e]],
    ];
    for (const [text, encoded] of cases)
      expect(utf8(text)).toEqual(Uint8Array.from(encoded));
  });
});
