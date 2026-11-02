/*
 * Bytes para o protocolo dos tokens: base64 (a comum e a de URL), hex,
 * números grandes, concatenação e comparação. O Hermes não tem Buffer nem um
 * atob confiável, então o app converte por conta própria, só com aritmética.
 */

const STANDARD =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Valor de cada caractere, nas duas formas (`+` e `-` valem 62; `/` e `_`, 63). */
const DECODE = new Map<string, number>(
  Array.from({ length: 64 }, (_, index) => [STANDARD.charAt(index), index]),
);
DECODE.set('-', 62);
DECODE.set('_', 63);

/**
 * Base64 com o `=` do fim; `url` troca `+/` por `-_` (o base64url que a
 * RFC 9577 e o servidor usam).
 */
export function toBase64(
  bytes: Uint8Array,
  { url = false }: { url?: boolean } = {},
): string {
  const alphabet = url ? URL_SAFE : STANDARD;
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const group =
      bytes[i] * 65536 + (bytes[i + 1] ?? 0) * 256 + (bytes[i + 2] ?? 0);
    out += alphabet.charAt(Math.floor(group / 262144));
    out += alphabet.charAt(Math.floor(group / 4096) % 64);
    out +=
      i + 1 < bytes.length ? alphabet.charAt(Math.floor(group / 64) % 64) : '=';
    out += i + 2 < bytes.length ? alphabet.charAt(group % 64) : '=';
  }
  return out;
}

/** Lê base64 nas duas formas, com ou sem o `=` do fim; `null` se não for. */
export function fromBase64(text: string): Uint8Array | null {
  const body = text.replace(/={1,2}$/, '');
  if (body.length % 4 === 1) return null;
  const values: number[] = [];
  for (const char of body) {
    const value = DECODE.get(char);
    if (value === undefined) return null;
    values.push(value);
  }
  const out = new Uint8Array(Math.floor((values.length * 3) / 4));
  let written = 0;
  for (let i = 0; i < values.length; i += 4) {
    const group =
      values[i] * 262144 +
      values[i + 1] * 4096 +
      (values[i + 2] ?? 0) * 64 +
      (values[i + 3] ?? 0);
    for (const byte of [
      Math.floor(group / 65536),
      Math.floor(group / 256) % 256,
      group % 256,
    ])
      if (written < out.length) out[written++] = byte;
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new RangeError('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** O inteiro sem sinal (big-endian) dos bytes. */
export const bytesToBigInt = (bytes: Uint8Array): bigint =>
  bytes.length ? BigInt(`0x${toHex(bytes)}`) : 0n;

/** O inteiro em exatamente `length` bytes (big-endian). */
export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const hex = value.toString(16).padStart(length * 2, '0');
  if (value < 0n || hex.length > length * 2)
    throw new RangeError('the integer does not fit');
  return fromHex(hex);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Inteiro sem sinal de 16 bits, big-endian. */
export const u16 = (value: number) =>
  Uint8Array.of(Math.floor(value / 256) % 256, value % 256);

/** Inteiro sem sinal de 32 bits, big-endian. */
export const u32 = (value: number) =>
  concat(u16(Math.floor(value / 65536) % 65536), u16(value % 65536));

/** Texto ASCII (nomes e rótulos do protocolo). */
export function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127) throw new RangeError('not ASCII');
    out[i] = code;
  }
  return out;
}
