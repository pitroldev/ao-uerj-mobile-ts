import axios from 'axios';
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalCookieJar,
  PortalRequest,
  PortalTransport,
} from './contracts';

export function createNativePortalTransport(): PortalTransport {
  const http = axios.create({
    baseURL: 'https://www.alunoonline.uerj.br',
    timeout: 15_000,
    responseType: 'arraybuffer',
    withCredentials: true,
    validateStatus: () => true,
    transformResponse: [
      value => (value ? iconv.decode(Buffer.from(value), 'iso-8859-1') : ''),
    ],
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
    async request({ path, params, signal }: PortalRequest) {
      if (signal?.aborted) throw new AppError('CANCELLED');
      const started = generation;
      // Keep the native request alive until its cookie processing has settled.
      // Aborting XHR and immediately clearing the jar can race a late Set-Cookie.
      const request = http.get<string>(path, { params });
      pending.add(request);
      try {
        const response = await request;
        if (signal?.aborted || generation !== started)
          throw new AppError('CANCELLED');
        return { status: response.status, body: response.data };
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
      await Promise.allSettled([...pending]);
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
