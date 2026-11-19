import type { AppUpdatesPort } from '@root/modules/delivery/application/ports';
import { compareVersions } from '@root/modules/delivery/domain/appStatus';
import { APP_STORE_ID } from '@root/modules/delivery/domain/invite';
import type { AppUpdate } from '@root/modules/delivery/domain/updatePolicy';

/**
 * A ficha pública do app na App Store do Brasil: a versão mais nova e quando
 * ela saiu. Não leva nada do aluno (só o id do app, o mesmo do link da loja).
 */
export const APP_STORE_LOOKUP_URL = `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=br`;

const BUNDLE_ID = 'com.aouerjmobile';
const VERSION = /^\d+\.\d+\.\d+$/;
const DAY = 24 * 60 * 60 * 1000;
const TIMEOUT = 10_000;
/** A resposta vale por este tempo: o app pergunta a cada volta à tela, a Apple não precisa. */
const CACHE = 6 * 60 * 60 * 1000;

/** A mesma conta do `versionCode` do Android: MAJOR × 10⁷ + MINOR × 10⁴ + PATCH. */
function versionCode(version: string) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return major * 10_000_000 + minor * 10_000 + patch;
}

type Dependencies = {
  /** A versão do JavaScript que roda (a do `package.json`), a que o Sobre mostra. */
  appVersion: string;
  fetch?: typeof fetch;
  now?: () => number;
};

/**
 * A atualização no iPhone: a App Store não instala dentro do app, então a
 * checagem só diz se há versão mais nova na loja e há quantos dias. O
 * "Atualizar" abre a página do app (ver `AppUpdates`).
 */
export function createAppStoreUpdates({
  appVersion,
  fetch: request = globalThis.fetch,
  now = Date.now,
}: Dependencies): AppUpdatesPort {
  let cached: { at: number; update: AppUpdate } | null = null;

  async function lookup(): Promise<AppUpdate | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await request(APP_STORE_LOOKUP_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      const results = (body as { results?: unknown } | null)?.results;
      const app = Array.isArray(results)
        ? (results[0] as Record<string, unknown> | undefined)
        : undefined;
      const version =
        typeof app?.version === 'string' ? app.version.trim() : '';
      if (app?.bundleId !== BUNDLE_ID || !VERSION.test(version)) return null;
      const released = Date.parse(String(app.currentVersionReleaseDate));
      return {
        availability:
          compareVersions(version, appVersion) > 0 ? 'available' : 'none',
        version,
        versionCode: versionCode(version),
        stalenessDays: Number.isNaN(released)
          ? null
          : Math.max(0, Math.floor((now() - released) / DAY)),
        priority: 0,
        flexibleAllowed: false,
        immediateAllowed: false,
        installStatus: 'unknown',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    inApp: false,
    async check() {
      if (cached && now() - cached.at < CACHE) return cached.update;
      const update = await lookup();
      if (update) cached = { at: now(), update };
      return update;
    },
    start: async () => 'notAllowed',
    complete: async () => {
      throw new Error('A App Store não instala dentro do app.');
    },
    onInstallProgress: () => () => undefined,
  };
}
