import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  UnavailableError,
} from '../../shared/errors.ts';
import {
  answerFor,
  assetHashOf,
  bodyHashOf,
  isAssetHash,
  isContentType,
  isSignature,
  NO_UPDATE_AVAILABLE_DIRECTIVE,
  OTA_ASSET_GRACE_MS,
  OTA_ASSET_PATH,
  OTA_CACHED_RUNTIMES,
  OTA_CLOCK_SKEW_MS,
  OTA_KEPT_UPDATES,
  OTA_LATEST_CACHE_MS,
  readDirective,
  readManifest,
  type NewOtaEntry,
  type OtaEntry,
  type OtaPlatform,
} from './domain.ts';
import type {
  OtaAssetStore,
  OtaEntryRepository,
  OtaPublication,
  OtaSignatureVerifier,
  OtaUpdates,
} from './ports.ts';

/**
 * A última publicação de cada plataforma e runtime, guardada uns segundos:
 * todo app pergunta ao abrir. Até `OTA_CACHED_RUNTIMES` runtimes (o pedido
 * pode inventar um); publicar aqui esquece o daquele runtime na hora.
 */
function latestCache(entries: OtaEntryRepository, now: Clock) {
  const cache = new Map<
    string,
    { value: Promise<OtaEntry | null>; expiresAt: number }
  >();
  const keyOf = (platform: OtaPlatform, runtimeVersion: string) =>
    `${platform}\n${runtimeVersion}`;

  return {
    get(platform: OtaPlatform, runtimeVersion: string) {
      const key = keyOf(platform, runtimeVersion);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now()) return hit.value;
      cache.delete(key);
      if (cache.size >= OTA_CACHED_RUNTIMES) {
        const [oldest] = cache.keys();
        if (oldest !== undefined) cache.delete(oldest);
      }
      const value = entries.latest(platform, runtimeVersion);
      const entry = { value, expiresAt: now() + OTA_LATEST_CACHE_MS };
      cache.set(key, entry);
      // uma falha não fica guardada
      value.catch(() => {
        if (cache.get(key) === entry) cache.delete(key);
      });
      return value;
    },
    forget(platform: OtaPlatform, runtimeVersion: string) {
      cache.delete(keyOf(platform, runtimeVersion));
    },
  };
}

const invalidSignature = (message: string) =>
  new ForbiddenError('invalid_signature', message);

/**
 * As atualizações pelo ar. Quem publica é o CI, e a prova é a assinatura do
 * code signing (a mesma que o app confere): sem token nem senha no servidor.
 * As regras além da assinatura protegem contra a repetição de um texto
 * assinado, que é público (o app o recebe): o mesmo manifesto não volta a
 * ser o mais recente, nada mais velho que a última publicação entra, e o
 * bundle de uma plataforma não vira o de outra.
 */
export function createOtaUpdates({
  entries,
  assets,
  verifier,
  noUpdateSignature,
  assetOrigin,
  now = systemClock,
  onCleanupError = () => undefined,
}: {
  entries: OtaEntryRepository;
  assets: OtaAssetStore;
  /** A conferência das assinaturas; `null` (sem certificado) desliga as publicações. */
  verifier: OtaSignatureVerifier | null;
  /** A assinatura pronta de `NO_UPDATE_AVAILABLE_DIRECTIVE`; `null` responde 204. */
  noUpdateSignature: string | null;
  /** A origem das URLs dos arquivos; `null` aceita qualquer uma (o QA local). */
  assetOrigin: string | null;
  now?: Clock;
  /** Uma limpeza que falha não desfaz a publicação: só vai para o log. */
  onCleanupError?: (err: unknown) => void;
}): OtaUpdates {
  // uma assinatura errada faria todo app recusar o "nada novo": melhor não subir
  if (
    noUpdateSignature !== null &&
    !verifier?.verify(NO_UPDATE_AVAILABLE_DIRECTIVE, noUpdateSignature)
  )
    throw new Error(
      'the noUpdateAvailable signature does not match the OTA code signing certificate',
    );

  const latest = latestCache(entries, now);

  function requireVerifier(): OtaSignatureVerifier {
    if (!verifier)
      throw new UnavailableError(
        'ota_publishing_unavailable',
        'OTA publishing is off: the server has no code signing certificate',
      );
    return verifier;
  }

  function checkSigned(data: string, signature: string) {
    const signatures = requireVerifier();
    if (!isSignature(signature) || !signatures.verify(data, signature))
      throw invalidSignature(
        'The signature does not match the code signing certificate',
      );
  }

  /** Uma data do futuro travaria as publicações seguintes. */
  function checkNotAhead(at: Date, code: string, field: string) {
    if (at.getTime() > now() + OTA_CLOCK_SKEW_MS)
      throw new DomainError(code, `${field} is in the future`);
  }

  async function cleanup() {
    const keep = await entries.keptAssets(OTA_KEPT_UPDATES);
    return assets.prune(keep, new Date(now() - OTA_ASSET_GRACE_MS));
  }

  /**
   * Grava a publicação se ela é mais nova que a última do runtime (o app
   * ignora a mais velha, e um texto antigo repetido não volta a valer).
   */
  async function publish(
    entry: NewOtaEntry,
    findSame: () => Promise<OtaEntry | null>,
  ): Promise<OtaPublication> {
    const current = await entries.latest(entry.platform, entry.runtimeVersion);
    // a mesma publicação, gravada por um envio que chegou junto
    if (current?.bodyHash === entry.bodyHash)
      return { created: false, entry: current };
    if (current && entry.commitTime.getTime() <= current.commitTime.getTime())
      throw new ConflictError(
        'not_newer',
        `The latest ${current.kind} of this runtime is from ${current.commitTime.toISOString()}: publish something newer`,
      );
    const created = await entries.create(entry);
    if (!created) {
      // dois envios juntos: o outro gravou primeiro
      const same = await findSame();
      if (same?.bodyHash === entry.bodyHash)
        return { created: false, entry: same };
      throw new ConflictError(
        'update_conflict',
        'Another publication with this id was saved at the same time',
      );
    }
    latest.forget(entry.platform, entry.runtimeVersion);
    try {
      await cleanup();
    } catch (err) {
      onCleanupError(err);
    }
    return { created: true, entry: created };
  }

  /** Confere o envio de um arquivo e devolve o tipo dele. */
  function authorizeAsset({
    hash,
    signature,
    contentType,
  }: {
    hash: string;
    signature: string | undefined;
    contentType: string | undefined;
  }): string {
    requireVerifier();
    if (!isAssetHash(hash))
      throw new InvalidInputError(
        'the hash in the URL must be the base64url SHA-256 of the file',
      );
    if (!signature)
      throw invalidSignature(
        'expo-ota-signature is required: the signature of the hash',
      );
    checkSigned(hash, signature);
    if (!contentType || !isContentType(contentType))
      throw new InvalidInputError(
        'content-type must be the type of the file, like image/png',
      );
    return contentType;
  }

  return {
    publishing: verifier !== null,

    async check({ platform, runtimeVersion, currentUpdateId }) {
      const entry = await latest.get(platform, runtimeVersion);
      return answerFor(entry, currentUpdateId, noUpdateSignature);
    },

    asset: async hash => (isAssetHash(hash) ? assets.get(hash) : null),

    authorizeAsset,

    async uploadAsset({ content, ...upload }) {
      const contentType = authorizeAsset(upload);
      if (assetHashOf(content) !== upload.hash)
        throw new DomainError(
          'hash_mismatch',
          'The SHA-256 of the body is not the hash in the URL',
        );
      return assets.put(upload.hash, content, contentType);
    },

    async publishUpdate({ platform, runtimeVersion, manifest, signature }) {
      checkSigned(manifest, signature);
      const facts = readManifest(manifest, {
        runtimeVersion,
        origin: assetOrigin,
      });
      const bodyHash = bodyHashOf(manifest);
      const findSame = () =>
        entries.findByUpdateId(platform, runtimeVersion, facts.updateId);
      // o mesmo manifesto de novo (o CI que repete, ou alguém que o copiou do
      // app) não muda nada, nem volta a ser o mais recente
      const same = await findSame();
      if (same) {
        if (same.bodyHash === bodyHash) return { created: false, entry: same };
        throw new ConflictError(
          'update_conflict',
          `Update ${facts.updateId} was already published with another manifest`,
        );
      }
      checkNotAhead(facts.createdAt, 'invalid_manifest', 'createdAt');
      const missing = await assets.retain(facts.assets);
      if (missing.length)
        throw new DomainError(
          'unknown_asset',
          `${missing.length} file(s) of the manifest were not uploaded, like ${missing[0]}: send them first (PUT ${OTA_ASSET_PATH}<hash>)`,
        );
      if (
        await entries.isLaunchAssetOfOtherPlatform(facts.launchAsset, platform)
      )
        throw new DomainError(
          'platform_mismatch',
          'The launch asset of this manifest is the bundle of another platform',
        );
      return publish(
        {
          platform,
          runtimeVersion,
          kind: 'manifest',
          body: manifest,
          signature,
          bodyHash,
          updateId: facts.updateId,
          commitTime: facts.createdAt,
          launchAsset: facts.launchAsset,
          assets: facts.assets,
          publishedAt: new Date(now()),
        },
        findSame,
      );
    },

    async publishDirective({ platform, runtimeVersion, directive, signature }) {
      checkSigned(directive, signature);
      const { commitTime } = readDirective(directive);
      const bodyHash = bodyHashOf(directive);
      const findSame = () =>
        entries.findByBodyHash(platform, runtimeVersion, bodyHash);
      const same = await findSame();
      if (same) return { created: false, entry: same };
      checkNotAhead(commitTime, 'invalid_directive', 'parameters.commitTime');
      return publish(
        {
          platform,
          runtimeVersion,
          kind: 'directive',
          body: directive,
          signature,
          bodyHash,
          updateId: null,
          commitTime,
          launchAsset: null,
          assets: [],
          publishedAt: new Date(now()),
        },
        findSame,
      );
    },

    cleanup,
  };
}
