const axios = require('axios');

/** Node counterpart of the native transport. This isolated jar never reads
 * browser cookies and only sends credentials to the configured AO origin. */
function createNodePortalTransport() {
  const origin = 'https://www.alunoonline.uerj.br';
  const jar = new Map();
  const active = new Map();
  let requests = 0;
  let logins = 0;

  const transport = {
    request({ path, params, signal }) {
      const url = new URL(path, origin);
      if (url.origin !== origin)
        return Promise.reject(new Error('UNEXPECTED_ORIGIN'));
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      requests += 1;
      if (params?.matricula && params?.senha) logins += 1;
      const task = axios
        .get(url.href, {
          params,
          signal: controller.signal,
          timeout: 15_000,
          maxRedirects: 0,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            Cookie: [...jar]
              .map(([name, value]) => `${name}=${value}`)
              .join('; '),
          },
        })
        .then(response => {
          for (const cookie of response.headers['set-cookie'] || []) {
            const pair = cookie.split(';')[0];
            const separator = pair.indexOf('=');
            const name = pair.slice(0, separator);
            const value = pair.slice(separator + 1);
            if (/max-age=0\b/i.test(cookie)) jar.delete(name);
            else jar.set(name, value);
          }
          return {
            status: response.status,
            // Same decoding as the app (WHATWG windows-1252).
            body: new TextDecoder('windows-1252').decode(response.data),
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
