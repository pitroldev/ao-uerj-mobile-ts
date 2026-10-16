import axios from 'axios';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalCookieJar,
  PortalRequest,
  PortalTransport,
} from './contracts';
import { decodePortalResponse, MAX_DOCUMENT_BYTES } from './portalResponse';

const ORIGIN = 'https://www.alunoonline.uerj.br';

function trustedUrl(path: string): string {
  // React Native's URL polyfill does not resolve all WHATWG URL forms.
  // Accept only an absolute portal URL or a root-relative portal path.
  const url =
    path.startsWith('/') && !path.startsWith('//') ? `${ORIGIN}${path}` : path;
  if (
    url.includes('\\') ||
    Array.from(url).some(character => character.charCodeAt(0) <= 0x20) ||
    (url !== ORIGIN && !url.startsWith(`${ORIGIN}/`))
  )
    throw new AppError('INVALID_INPUT');
  return url === ORIGIN ? `${ORIGIN}/` : url;
}

export function createNativePortalTransport(): PortalTransport {
  const http = axios.create({
    baseURL: ORIGIN,
    timeout: 15_000,
    responseType: 'arraybuffer',
    withCredentials: true,
    validateStatus: () => true,
    transformResponse: [value => value],
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      // AO authenticates through a GET URL containing the password. The native
      // HTTP cache would otherwise persist that URL alongside the response.
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  });
  const pending = new Set<Promise<unknown>>();
  let generation = 0;

  return {
    async request({
      path,
      params,
      signal,
      method = 'GET',
      responseType,
    }: PortalRequest) {
      if (signal?.aborted) throw new AppError('CANCELLED');
      const url = trustedUrl(path);
      const started = generation;
      // Keep the native request alive until its cookie processing has settled.
      // Aborting XHR and immediately clearing the jar can race a late Set-Cookie.
      const options =
        responseType === 'pdf' ? { maxContentLength: MAX_DOCUMENT_BYTES } : {};
      const request =
        method === 'POST'
          ? http.post<ArrayBuffer>(
              url,
              Object.entries(params ?? {})
                .filter(
                  (entry): entry is [string, string] => entry[1] !== undefined,
                )
                .map(
                  ([name, value]) =>
                    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
                )
                .join('&'),
              options,
            )
          : http.get<ArrayBuffer>(url, { ...options, params });
      pending.add(request);
      try {
        const response = await request;
        if (signal?.aborted || generation !== started)
          throw new AppError('CANCELLED');
        const header = response.headers?.['content-type'];
        return decodePortalResponse(
          response.status,
          new Uint8Array(response.data || 0),
          typeof header === 'string' ? header : undefined,
          responseType,
        );
      } catch (error) {
        if (signal?.aborted || generation !== started)
          throw new AppError('CANCELLED');
        if (error instanceof AppError) throw error;
        throw new AppError('NETWORK');
      } finally {
        pending.delete(request);
      }
    },
    async cancelAndDrain() {
      generation += 1;
      await Promise.allSettled(pending);
    },
  };
}

export function createNativeCookieJar(): PortalCookieJar {
  return {
    async clear() {
      try {
        await CookieManager.clearAll();
      } catch {
        throw new AppError('STORAGE_FAILED');
      }
    },
  };
}
