import { AppError } from '@root/shared/errors/AppError';
import type { PortalRequest, PortalResponse } from './contracts';
import { decodeWindows1252 } from './windows1252';

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function hasPdfEndMarker(bytes: Uint8Array): boolean {
  let end = bytes.length;
  // PDF whitespace can follow the final marker, including after incremental
  // updates. A successful HTTP response with a partial body must not be shown
  // as a ready-to-open document.
  while (end > 0 && [0, 9, 10, 12, 13, 32].includes(bytes[end - 1])) end -= 1;
  return (
    end >= 5 &&
    bytes[end - 5] === 0x25 &&
    bytes[end - 4] === 0x25 &&
    bytes[end - 3] === 0x45 &&
    bytes[end - 2] === 0x4f &&
    bytes[end - 1] === 0x46
  );
}

/* oxlint-disable no-bitwise -- Base64 splits each 24-bit group into four 6-bit indices. */
function encodeBase64(bytes: Uint8Array): string {
  // Hermes does not provide the browser's btoa. Encode the bytes directly,
  // keeping temporary arrays bounded even for a document at the size limit.
  const chunkSize = 24_576;
  const completeLength = bytes.length - (bytes.length % 3);
  const parts: string[] = [];
  for (let offset = 0; offset < completeLength; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, completeLength);
    const encoded: string[] = [];
    for (let index = offset; index < end; index += 3) {
      const value =
        (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
      encoded.push(
        BASE64_ALPHABET[value >>> 18] +
          BASE64_ALPHABET[(value >>> 12) & 63] +
          BASE64_ALPHABET[(value >>> 6) & 63] +
          BASE64_ALPHABET[value & 63],
      );
    }
    parts.push(encoded.join(''));
  }
  if (completeLength < bytes.length) {
    const first = bytes[completeLength];
    const second = bytes[completeLength + 1];
    const hasSecond = completeLength + 1 < bytes.length;
    parts.push(
      BASE64_ALPHABET[first >>> 2] +
        BASE64_ALPHABET[((first & 3) << 4) | (hasSecond ? second >>> 4 : 0)] +
        (hasSecond ? BASE64_ALPHABET[(second & 15) << 2] : '=') +
        '=',
    );
  }
  return parts.join('');
}
/* oxlint-enable no-bitwise */

export function decodePortalResponse(
  status: number,
  bytes: Uint8Array,
  contentType: string | undefined,
  responseType: PortalRequest['responseType'],
): PortalResponse {
  const mime = contentType?.split(';', 1)[0].trim().toLowerCase();
  if (responseType === 'pdf') {
    if (bytes.byteLength > MAX_DOCUMENT_BYTES)
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    const isPdf =
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
    if (isPdf) {
      if (mime !== 'application/pdf' && mime !== 'application/octet-stream')
        throw new AppError('PORTAL_LAYOUT_CHANGED');
      if (!hasPdfEndMarker(bytes)) throw new AppError('PORTAL_LAYOUT_CHANGED');
      return {
        status,
        body: '',
        pdfBase64: encodeBase64(bytes),
        contentType: mime,
      };
    }
  }
  // An expired session can return HTML even when a PDF was requested.
  return {
    status,
    body: decodeWindows1252(bytes),
    ...(mime ? { contentType: mime } : {}),
  };
}
