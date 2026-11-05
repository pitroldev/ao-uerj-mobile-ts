/*
 * Bytes para a sessão de aluno: base64 (a comum e a de URL), hex, UTF-8,
 * ASCII e concatenação. O Hermes não tem Buffer nem um
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

/** Lê hex (o `requestHash`), em maiúsculas ou minúsculas; `null` se não for. */
export function fromHex(text: string): Uint8Array | null {
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) return null;
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
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

/** Inteiro sem sinal de 16 bits, big-endian. */
export const u16 = (value: number) =>
  Uint8Array.of(Math.floor(value / 256) % 256, value % 256);

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

/** Texto em UTF-8 (o nome do aluno no pedido de sessão), só com aritmética. */
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const tail = (shift: number) => 0x80 + (Math.floor(code / shift) % 64);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 + Math.floor(code / 64), tail(1));
    else if (code < 0x10000)
      out.push(0xe0 + Math.floor(code / 4096), tail(64), tail(1));
    else
      out.push(0xf0 + Math.floor(code / 262144), tail(4096), tail(64), tail(1));
  }
  return Uint8Array.from(out);
}
