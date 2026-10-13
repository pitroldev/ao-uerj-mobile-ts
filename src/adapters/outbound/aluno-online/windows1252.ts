// WHATWG mapping for 0x80–0x9F. The five unassigned bytes stay C1 controls, as
// in browsers; every other byte is already its own code point.
const C1_RANGE = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030,
  0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d,
  0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e,
  0x178,
];

// Bounds the argument count of each String.fromCharCode call.
const CHUNK_SIZE = 8192;

/**
 * Decodes windows-1252, which is what browsers do with pages declared as
 * ISO-8859-1 (as the portal's are): curly quotes, dashes and € no longer
 * become invisible control characters.
 */
export function decodeWindows1252(bytes: Uint8Array): string {
  let text = '';
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) {
    const codes = Array.from(bytes.subarray(start, start + CHUNK_SIZE), byte =>
      byte >= 0x80 && byte < 0xa0 ? C1_RANGE[byte - 0x80] : byte,
    );
    text += String.fromCharCode(...codes);
  }
  return text;
}
