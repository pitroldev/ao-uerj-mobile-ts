const axios = require('axios');
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from('%PDF-');
const PDF_END_MARKER = Buffer.from('%%EOF');

function hasPdfEndMarker(bytes) {
  let end = bytes.length;
  // Match the native decoder: only PDF whitespace may follow the last EOF.
  // An earlier marker does not make a truncated incremental update complete.
  while (end > 0 && [0, 9, 10, 12, 13, 32].includes(bytes[end - 1])) end -= 1;
  return end >= 5 && bytes.subarray(end - 5, end).equals(PDF_END_MARKER);
}

/** Node counterpart of the native transport. This isolated jar never reads
 * browser cookies and only sends credentials to the configured AO origin. */
function createNodePortalTransport() {
  const origin = 'https://www.alunoonline.uerj.br';
  const jar = new Map();
  const active = new Map();
  let requests = 0;
  let logins = 0;

  const transport = {
    request({ path, params, signal, method = 'GET', responseType }) {
      const url = new URL(path, origin);
      if (url.origin !== origin || url.username || url.password)
        return Promise.reject(new Error('UNEXPECTED_ORIGIN'));
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      requests += 1;
      if (params?.matricula && params?.senha) logins += 1;
      const options = {
        signal: controller.signal,
        timeout: 15_000,
        maxRedirects: 0,
        ...(responseType === 'pdf'
          ? { maxContentLength: MAX_DOCUMENT_BYTES }
          : {}),
        responseType: 'arraybuffer',
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          Cookie: [...jar]
            .map(([name, value]) => `${name}=${value}`)
            .join('; '),
        },
      };
      const data = new URLSearchParams();
      for (const [name, value] of Object.entries(params || {}))
        if (value !== undefined) data.append(name, value);
      const task = (
        method === 'POST'
          ? axios.post(url.href, data.toString(), options)
          : axios.get(url.href, { ...options, params })
      )
        .then(response => {
          for (const cookie of response.headers['set-cookie'] || []) {
            const pair = cookie.split(';')[0];
            const separator = pair.indexOf('=');
            const name = pair.slice(0, separator);
            const value = pair.slice(separator + 1);
            if (/max-age=0\b/i.test(cookie)) jar.delete(name);
            else jar.set(name, value);
          }
          const bytes = Buffer.from(response.data);
          const contentType = response.headers['content-type']
            ?.split(';', 1)[0]
            .trim()
            .toLowerCase();
          if (responseType === 'pdf') {
            if (bytes.byteLength > MAX_DOCUMENT_BYTES)
              throw new Error('PORTAL_LAYOUT_CHANGED');
            if (bytes.subarray(0, 5).equals(PDF_SIGNATURE)) {
              if (
                contentType !== 'application/pdf' &&
                contentType !== 'application/octet-stream'
              )
                throw new Error('PORTAL_LAYOUT_CHANGED');
              if (!hasPdfEndMarker(bytes))
                throw new Error('PORTAL_LAYOUT_CHANGED');
              return {
                status: response.status,
                body: '',
                pdfBase64: bytes.toString('base64'),
                contentType,
              };
            }
          }
          return {
            status: response.status,
            // Same decoding as the app (WHATWG windows-1252).
            body: new TextDecoder('windows-1252').decode(bytes),
            ...(contentType ? { contentType } : {}),
          };
        })
        .finally(() => {
          active.delete(controller);
          signal?.removeEventListener('abort', abort);
        });
      active.set(controller, task);
      return task;
    },
    async cancelAndDrain() {
      const pending = [...active.values()];
      for (const controller of active.keys()) controller.abort();
      await Promise.allSettled(pending);
    },
  };
  return {
    transport,
    cookies: { clear: async () => jar.clear() },
    counts: () => ({ requests, logins }),
  };
}

module.exports = { createNodePortalTransport };
