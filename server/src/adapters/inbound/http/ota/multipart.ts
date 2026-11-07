import { randomBytes } from 'node:crypto';

/** Uma parte de uma resposta `multipart/mixed`. */
export type Part = {
  /** O `name` do `content-disposition`: `manifest`, `extensions` ou `directive`. */
  name: string;
  contentType: string;
  /** Outros cabeçalhos da parte (o `expo-signature`), com o nome em minúsculas. */
  headers?: Record<string, string>;
  body: string;
};

const newBoundary = () => `ota-${randomBytes(18).toString('hex')}`;

/**
 * Um `multipart/mixed` (RFC 2046) como o expo-updates lê: CRLF, e cada parte
 * com `content-type`, `content-disposition: form-data; name="…"` e os outros
 * cabeçalhos, todos com o nome em minúsculas (o do iPhone procura o
 * `expo-signature` assim, sem ignorar a caixa). O corpo vai como está, sem
 * nada antes nem depois: o CRLF que o segue é parte do delimitador, e o app
 * confere a assinatura sobre esses bytes.
 */
export function multipartMixed(
  parts: readonly Part[],
  boundaryOf: () => string = newBoundary,
): { contentType: string; body: Buffer } {
  let boundary = boundaryOf();
  // o delimitador não pode aparecer num corpo (ao acaso, não aparece)
  while (parts.some(part => part.body.includes(boundary)))
    boundary = newBoundary();
  const chunks: string[] = [];
  for (const part of parts) {
    const headers = {
      'content-type': part.contentType,
      'content-disposition': `form-data; name="${part.name}"`,
      ...part.headers,
    };
    chunks.push(`--${boundary}\r\n`);
    for (const [name, value] of Object.entries(headers))
      chunks.push(`${name}: ${value}\r\n`);
    chunks.push('\r\n', part.body, '\r\n');
  }
  chunks.push(`--${boundary}--\r\n`);
  return {
    contentType: `multipart/mixed; boundary=${boundary}`,
    body: Buffer.from(chunks.join(''), 'utf8'),
  };
}
