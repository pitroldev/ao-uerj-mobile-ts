/*
 * Um leitor de CBOR (RFC 8949) mínimo e estrito, feito para o objeto de
 * atestação do App Attest: bytes, texto, listas e mapas com chave de texto,
 * todos de tamanho definido. Recusa o resto (inteiros, tags, números de ponto
 * flutuante, tamanho indefinido), chave repetida, texto que não é UTF-8,
 * bytes sobrando no fim e aninhamento ou listas além dos limites. Os bytes
 * devolvidos são fatias da entrada, sem cópia.
 */

export type CborValue = Buffer | string | CborValue[] | CborMap;
export type CborMap = Map<string, CborValue>;

export class CborError extends Error {}

/** Os limites. O objeto da Apple tem 4 níveis e no máximo 3 entradas por nível. */
export type CborLimits = { maxDepth: number; maxItems: number };

const DEFAULT_LIMITS: CborLimits = { maxDepth: 6, maxItems: 16 };

const BYTES = 2;
const TEXT = 3;
const ARRAY = 4;
const MAP = 5;

/** Os bytes do argumento depois do cabeçalho (24 a 27); 28 a 31 não valem. */
const ARGUMENT_SIZES: Readonly<Record<number, number>> = {
  24: 1,
  25: 2,
  26: 4,
  27: 8,
};

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function decodeCbor(
  bytes: Buffer,
  { maxDepth, maxItems }: CborLimits = DEFAULT_LIMITS,
): CborValue {
  let offset = 0;
  const fail = (message: string): never => {
    throw new CborError(`${message} at byte ${offset}`);
  };
  const need = (length: number) => {
    if (length > bytes.length - offset) fail('truncated');
  };

  /** O argumento: o tamanho dos bytes e do texto, a contagem das listas e dos mapas. */
  const argument = (info: number): number => {
    if (info < 24) return info;
    const size = ARGUMENT_SIZES[info];
    if (!size) return fail('unsupported length encoding');
    need(size);
    let value: number;
    if (size === 8) {
      const big = bytes.readBigUInt64BE(offset);
      // maior que a entrada inteira: o `need` de quem chamou recusa
      value = big > BigInt(bytes.length) ? Infinity : Number(big);
    } else value = bytes.readUIntBE(offset, size);
    offset += size;
    return value;
  };

  const slice = (length: number) => {
    need(length);
    const value = bytes.subarray(offset, offset + length);
    offset += length;
    return value;
  };

  const item = (depth: number): CborValue => {
    if (depth > maxDepth) return fail('nested too deep');
    need(1);
    const initial = bytes.readUInt8(offset);
    offset += 1;
    // os 3 bits de cima são o tipo; os 5 de baixo, o argumento
    const major = Math.floor(initial / 32);
    const length = argument(initial % 32);
    switch (major) {
      case BYTES:
        return slice(length);
      case TEXT: {
        const raw = slice(length);
        try {
          return utf8.decode(raw);
        } catch {
          return fail('text is not UTF-8');
        }
      }
      case ARRAY: {
        if (length > maxItems) return fail('too many items');
        const list: CborValue[] = [];
        for (let index = 0; index < length; index++) list.push(item(depth + 1));
        return list;
      }
      case MAP: {
        if (length > maxItems) return fail('too many entries');
        const map: CborMap = new Map();
        for (let index = 0; index < length; index++) {
          const key = item(depth + 1);
          if (typeof key !== 'string') return fail('a map key must be text');
          if (map.has(key)) return fail('repeated map key');
          map.set(key, item(depth + 1));
        }
        return map;
      }
      default:
        return fail(`unsupported CBOR major type ${major}`);
    }
  };

  const value = item(1);
  if (offset !== bytes.length) fail('trailing bytes');
  return value;
}

export const isCborMap = (value: CborValue | undefined): value is CborMap =>
  value instanceof Map;

export const isCborBytes = (value: CborValue | undefined): value is Buffer =>
  Buffer.isBuffer(value);
