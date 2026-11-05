/*
 * Um leitor de DER (X.690) mínimo, para achar uma extensão dentro de um
 * certificado que o `X509Certificate` do Node já leu (ele não mostra as
 * extensões que não conhece). Só o formato: tag de um byte, tamanho definido
 * na forma mais curta e nada sobrando dentro de quem contém.
 */

export class DerError extends Error {}

/** Um elemento: a tag (o byte inteiro, com a classe e o "construído") e o conteúdo. */
export type DerElement = { tag: number; content: Buffer };

export const DER = {
  BOOLEAN: 0x01,
  OCTET_STRING: 0x04,
  OID: 0x06,
  SEQUENCE: 0x30,
  /** [1] EXPLICIT, construído, da classe de contexto. */
  CONTEXT_1: 0xa1,
  /** [3] EXPLICIT: as extensões do TBSCertificate. */
  CONTEXT_3: 0xa3,
} as const;

/** Elementos por nível: um certificado tem uns 10; as extensões, poucas. */
const MAX_CHILDREN = 64;

/** O elemento que começa em `offset` e onde ele termina. */
function readElement(
  bytes: Buffer,
  offset: number,
): { element: DerElement; end: number } {
  if (bytes.length - offset < 2) throw new DerError('truncated');
  const tag = bytes.readUInt8(offset);
  // tag 31 nos 5 bits de baixo: o número vem nos bytes seguintes (não usado aqui)
  if (tag % 32 === 31) throw new DerError('multi-byte tags are not supported');
  const first = bytes.readUInt8(offset + 1);
  let start = offset + 2;
  let length = first;
  if (first === 0x80) throw new DerError('indefinite length');
  if (first > 0x80) {
    const size = first - 0x80;
    if (size > 4 || bytes.length - start < size)
      throw new DerError('bad length');
    length = bytes.readUIntBE(start, size);
    start += size;
    // a forma mais curta: sem zero na frente, e a longa só a partir de 128
    if (bytes.readUInt8(offset + 2) === 0 || length < 0x80)
      throw new DerError('length is not minimal');
  }
  if (bytes.length - start < length) throw new DerError('truncated');
  return {
    element: { tag, content: bytes.subarray(start, start + length) },
    end: start + length,
  };
}

/** O único elemento de `bytes`, que tem de ser da tag esperada e ocupar tudo. */
export function only(bytes: Buffer, tag: number): DerElement {
  const { element, end } = readElement(bytes, 0);
  if (element.tag !== tag) throw new DerError(`expected tag ${tag}`);
  if (end !== bytes.length) throw new DerError('trailing bytes');
  return element;
}

/** Os elementos dentro de um construído (SEQUENCE, [n] EXPLICIT), na ordem. */
export function children(content: Buffer): DerElement[] {
  const found: DerElement[] = [];
  let offset = 0;
  while (offset < content.length) {
    if (found.length === MAX_CHILDREN) throw new DerError('too many elements');
    const { element, end } = readElement(content, offset);
    found.push(element);
    offset = end;
  }
  return found;
}
