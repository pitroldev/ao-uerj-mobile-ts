import { createHash } from 'node:crypto';

import { DomainError } from '../../shared/errors.ts';

/*
 * As atualizações pelo ar (OTA): o protocolo 1 do expo-updates
 * (https://docs.expo.dev/technical-specs/expo-updates-1/). O app pergunta
 * pela mais recente da plataforma e do runtime dele; o CI publica os
 * arquivos, os manifestos e as diretivas, cada um assinado com a chave do
 * code signing, que só o CI tem. O servidor confere a assinatura, guarda o
 * texto como chegou e o devolve ao app sem mudar um byte: é sobre esses
 * bytes que o app confere a assinatura.
 */

export const OTA_PLATFORMS = ['android', 'ios'] as const;
export type OtaPlatform = (typeof OTA_PLATFORMS)[number];

export const isOtaPlatform = (value: unknown): value is OtaPlatform =>
  value === 'android' || value === 'ios';

/** O `keyid` do code signing que o app conhece (`codeSigningMetadata`). */
export const OTA_KEY_ID = 'main';

/** Onde cada arquivo fica, pelo hash: as URLs dos manifestos apontam para cá. */
export const OTA_ASSET_PATH = '/aouerj/ota/assets/';

/**
 * A resposta de quem já está na mais recente (ou não tem nenhuma). É sempre
 * este texto, byte a byte: a assinatura dele é feita uma vez, fora do
 * servidor, porque a chave privada fica só no CI.
 */
export const NO_UPDATE_AVAILABLE_DIRECTIVE = '{"type":"noUpdateAvailable"}';

export const OTA_LIMITS = {
  runtimeVersion: 255,
  /** O manifesto, em caracteres: uns 300 por arquivo. */
  manifest: 512 * 1024,
  directive: 4 * 1024,
  /** Os arquivos de um manifesto, além do de entrada. */
  assets: 1000,
  /** A assinatura em base64: 684 caracteres numa chave RSA de 4096 bits. */
  signature: 1024,
  assetKey: 255,
  contentType: 255,
  fileExtension: 64,
  url: 2048,
} as const;

/** Os manifestos mais recentes de cada plataforma e runtime que guardam os arquivos. */
export const OTA_KEPT_UPDATES = 3;

/**
 * Um arquivo enviado, reenviado ou citado num manifesto há menos disto fica,
 * mesmo sem manifesto que o guarde: o CI manda os arquivos antes do
 * manifesto.
 */
export const OTA_ASSET_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A folga do relógio do CI. Uma data mais adiante que isto é recusada: ela
 * travaria as publicações seguintes, que precisam ser mais novas.
 */
export const OTA_CLOCK_SKEW_MS = 60 * 60 * 1000;

/** Quanto a mais recente de cada plataforma e runtime fica no processo. */
export const OTA_LATEST_CACHE_MS = 10 * 1000;

/** Quantos runtimes o processo guarda (um pedido pode inventar o runtime). */
export const OTA_CACHED_RUNTIMES = 1000;

/** Um runtime como o app manda no cabeçalho: uma linha de ASCII visível. */
const RUNTIME_VERSION = /^[!-~]{1,255}$/;

export const isRuntimeVersion = (value: string) => RUNTIME_VERSION.test(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O `expo-current-update-id`: um UUID, em minúsculas; outra coisa vale como ausente. */
export const updateIdOf = (value: string | undefined) =>
  value && UUID.test(value) ? value.toLowerCase() : null;

/** O `hash` do protocolo: o SHA-256 do arquivo em base64url, sem `=`. */
export const assetHashOf = (content: Uint8Array) =>
  createHash('sha256').update(content).digest('base64url');

/**
 * Um hash de arquivo: 43 caracteres de base64url na forma canônica (a que
 * `assetHashOf` dá), para um arquivo ter um nome só.
 */
export function isAssetHash(value: string): boolean {
  return (
    /^[A-Za-z0-9_-]{43}$/.test(value) &&
    Buffer.from(value, 'base64url').toString('base64url') === value
  );
}

/** O id de um texto guardado: o mesmo texto é a mesma publicação. */
export const bodyHashOf = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Uma assinatura em base64 padrão, na forma canônica: o app a decodifica do
 * `expo-signature` com o decodificador dele, e ela tem de dar os mesmos bytes.
 */
export function isSignature(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= OTA_LIMITS.signature &&
    BASE64.test(value) &&
    Buffer.from(value, 'base64').toString('base64') === value
  );
}

// os caracteres de um token do HTTP (RFC 9110, 5.6.2)
const TOKEN = "[\\w!#$%&'*+.^`|~-]+";
const CONTENT_TYPE = new RegExp(
  `^${TOKEN}/${TOKEN}(?:\\s*;\\s*${TOKEN}=(?:${TOKEN}|"[ !#-~]*"))*$`,
);

/** O tipo de um arquivo, como vai no `content-type` (`image/png`). */
export const isContentType = (value: string) =>
  value.length <= OTA_LIMITS.contentType && CONTENT_TYPE.test(value);

const ISO_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Uma data como o expo-updates do Android a lê (`yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`),
 * a de `toISOString()`: sem os milissegundos, ele usa a hora do aparelho, e a
 * ordem das atualizações se perde.
 */
export function timestampOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_MILLIS.test(value)) return null;
  const date = new Date(value);
  // o Date aceita 30 de fevereiro e passa para março: a volta confere
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
    ? date
    : null;
}

/** O que o servidor tira de um manifesto para guardá-lo. */
export type ManifestFacts = {
  /** O `id`, em minúsculas (como o app manda no `expo-current-update-id`). */
  updateId: string;
  createdAt: Date;
  /** O hash do arquivo de entrada (o bundle). */
  launchAsset: string;
  /** Os hashes de todos os arquivos, o de entrada primeiro, sem repetir. */
  assets: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** O app grava cada arquivo como `key` + `fileExtension`: sem barra nem `..`. */
const isSafeName = (value: string) =>
  value !== '.' &&
  value !== '..' &&
  !/[/\\]/.test(value) &&
  !value.includes(String.fromCharCode(0));

/**
 * A URL de um arquivo: `<origem>/aouerj/ota/assets/<hash>` do próprio
 * arquivo, sem query. Com `origin`, só nela (na produção, a do app).
 */
function pointsToAsset(text: string, hash: string, origin: string | null) {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    (origin === null || url.origin === origin) &&
    url.pathname === `${OTA_ASSET_PATH}${hash}` &&
    // a forma canônica (sem escapes), sem query, fragmento nem credenciais
    url.href === text &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}

type AssetFacts = { hash: string; key: string; fileExtension: string | null };

function readAsset(
  value: unknown,
  where: string,
  { launch, origin }: { launch: boolean; origin: string | null },
): AssetFacts {
  const fail = (message: string) =>
    new DomainError('invalid_manifest', `${where}: ${message}`);
  if (!isRecord(value)) throw fail('must be an object');
  const { hash, key, contentType, fileExtension, url } = value;
  if (typeof hash !== 'string' || !isAssetHash(hash))
    throw fail('hash must be the base64url SHA-256 of the file');
  if (
    typeof key !== 'string' ||
    !key ||
    key.length > OTA_LIMITS.assetKey ||
    !isSafeName(key)
  )
    throw fail('key must be a file name');
  if (
    typeof contentType !== 'string' ||
    !contentType ||
    contentType.length > OTA_LIMITS.contentType
  )
    throw fail('contentType is required');
  // o Android pula o arquivo que vem sem a extensão (só o de entrada dispensa)
  if (fileExtension !== undefined || !launch) {
    if (
      typeof fileExtension !== 'string' ||
      !fileExtension.startsWith('.') ||
      fileExtension.length > OTA_LIMITS.fileExtension ||
      !isSafeName(fileExtension)
    )
      throw fail('fileExtension must start with a dot, like .png');
  }
  if (
    typeof url !== 'string' ||
    url.length > OTA_LIMITS.url ||
    !pointsToAsset(url, hash, origin)
  )
    throw fail(`url must be ${origin ?? '<origin>'}${OTA_ASSET_PATH}${hash}`);
  return {
    hash,
    key,
    fileExtension: typeof fileExtension === 'string' ? fileExtension : null,
  };
}

/**
 * Confere um manifesto antes de guardá-lo: o que o app precisa para usá-lo
 * (o `id`, a data com milissegundos, o runtime pedido, os arquivos com a URL
 * daqui) e o que o servidor precisa para servi-lo. O resto (`metadata`,
 * `extra`) passa como veio.
 */
export function readManifest(
  text: string,
  {
    runtimeVersion,
    origin,
  }: {
    runtimeVersion: string;
    /** A origem das URLs dos arquivos; `null` aceita qualquer uma (o QA local). */
    origin: string | null;
  },
): ManifestFacts {
  const fail = (message: string) =>
    new DomainError('invalid_manifest', message);
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw fail('the manifest is not JSON');
  }
  if (!isRecord(manifest)) throw fail('the manifest must be a JSON object');
  const { id } = manifest;
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('id must be a UUID');
  const createdAt = timestampOf(manifest.createdAt);
  if (!createdAt)
    throw fail(
      'createdAt must be a date like 2026-11-06T12:00:00.000Z, with the milliseconds',
    );
  if (manifest.runtimeVersion !== runtimeVersion)
    throw new DomainError(
      'runtime_mismatch',
      'The runtimeVersion of the manifest is not the one being published',
    );
  const launch = readAsset(manifest.launchAsset, 'launchAsset', {
    launch: true,
    origin,
  });
  const list = manifest.assets ?? [];
  if (!Array.isArray(list)) throw fail('assets must be a list');
  if (list.length > OTA_LIMITS.assets)
    throw fail(`assets must have at most ${OTA_LIMITS.assets} files`);
  const assets = list.map((asset: unknown, index) =>
    readAsset(asset, `assets[${index}]`, { launch: false, origin }),
  );
  // a mesma chave é o mesmo arquivo no aparelho: só vale repetida igual
  const files = new Map<string, string>();
  for (const asset of [launch, ...assets]) {
    const file = `${asset.hash}${asset.fileExtension ?? ''}`;
    const seen = files.get(asset.key);
    if (seen !== undefined && seen !== file)
      throw fail(`two different files have the key ${asset.key}`);
    files.set(asset.key, file);
  }
  const { metadata, extra } = manifest;
  if (
    metadata !== undefined &&
    !(
      isRecord(metadata) &&
      Object.values(metadata).every(value => typeof value === 'string')
    )
  )
    throw fail('metadata must be an object of strings');
  if (extra !== undefined && !isRecord(extra))
    throw fail('extra must be an object');
  return {
    updateId: id.toLowerCase(),
    createdAt,
    launchAsset: launch.hash,
    assets: [...new Set([launch.hash, ...assets.map(asset => asset.hash)])],
  };
}

/**
 * Confere uma diretiva antes de guardá-la. Só a volta ao JS da build da loja
 * (`rollBackToEmbedded`) se publica; o `commitTime` é o que os aparelhos
 * comparam com o update que estão rodando.
 */
export function readDirective(text: string): { commitTime: Date } {
  const fail = (message: string) =>
    new DomainError('invalid_directive', message);
  let directive: unknown;
  try {
    directive = JSON.parse(text);
  } catch {
    throw fail('the directive is not JSON');
  }
  if (!isRecord(directive)) throw fail('the directive must be a JSON object');
  if (directive.type === 'noUpdateAvailable')
    throw fail(
      'noUpdateAvailable is the answer of the server itself; publish only rollBackToEmbedded',
    );
  if (directive.type !== 'rollBackToEmbedded')
    throw fail('type must be rollBackToEmbedded');
  const { parameters, extra } = directive;
  const commitTime = isRecord(parameters)
    ? timestampOf(parameters.commitTime)
    : null;
  if (!commitTime)
    throw fail(
      'parameters.commitTime must be a date like 2026-11-06T12:00:00.000Z, with the milliseconds',
    );
  if (extra !== undefined && !isRecord(extra))
    throw fail('extra must be an object');
  return { commitTime };
}

export type OtaEntryKind = 'manifest' | 'directive';

/** Uma publicação: um manifesto ou uma diretiva, como o CI assinou. */
export type OtaEntry = {
  id: string;
  platform: OtaPlatform;
  runtimeVersion: string;
  kind: OtaEntryKind;
  /** O manifesto ou a diretiva exatamente como chegou: o app confere estes bytes. */
  body: string;
  /** A assinatura do CI (base64), que vai no `expo-signature`. */
  signature: string;
  /** O SHA-256 do texto, em hex. */
  bodyHash: string;
  /** O `id` do manifesto, em minúsculas; `null` numa diretiva. */
  updateId: string | null;
  /** O `createdAt` do manifesto ou o `commitTime` da diretiva. */
  commitTime: Date;
  /** O arquivo de entrada do manifesto; `null` numa diretiva. */
  launchAsset: string | null;
  /** Os hashes de todos os arquivos do manifesto, o de entrada junto. */
  assets: string[];
  publishedAt: Date;
};

export type NewOtaEntry = Omit<OtaEntry, 'id'>;

/** A resposta ao app. */
export type OtaAnswer =
  | { kind: 'manifest'; body: string; signature: string }
  | { kind: 'directive'; body: string; signature: string }
  /**
   * Nada novo: a diretiva `noUpdateAvailable`, com a assinatura pronta; sem
   * ela, uma resposta vazia (204), que o expo-updates trata do mesmo jeito.
   */
  | { kind: 'noUpdate'; body: string; signature: string | null };

/**
 * O que responder a quem roda `currentUpdateId`, sendo `latest` a última
 * publicação da plataforma e do runtime dele. A volta ao JS da loja vai
 * sempre, mesmo para quem já roda o JS da loja: um update baixado e ainda
 * não aberto ganharia dele na próxima abertura, e o app ignora a mesma volta
 * repetida (o `commitTime` não é mais novo).
 */
export function answerFor(
  latest: OtaEntry | null,
  currentUpdateId: string | null,
  noUpdateSignature: string | null,
): OtaAnswer {
  const none: OtaAnswer = {
    kind: 'noUpdate',
    body: NO_UPDATE_AVAILABLE_DIRECTIVE,
    signature: noUpdateSignature,
  };
  if (!latest) return none;
  if (latest.kind === 'directive')
    return {
      kind: 'directive',
      body: latest.body,
      signature: latest.signature,
    };
  if (latest.updateId === currentUpdateId) return none;
  return { kind: 'manifest', body: latest.body, signature: latest.signature };
}
