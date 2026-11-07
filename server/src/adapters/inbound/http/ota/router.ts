import { pipeline } from 'node:stream/promises';

import express, {
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import {
  isOtaPlatform,
  isRuntimeVersion,
  OTA_KEY_ID,
  OTA_LIMITS,
  OTA_PLATFORMS,
  updateIdOf,
  type OtaAnswer,
  type OtaEntryKind,
  type OtaPlatform,
} from '../../../../modules/ota/domain.ts';
import type {
  AssetEncoding,
  OtaPublication,
  OtaRequest,
  OtaUpdates,
  StoredOtaAsset,
} from '../../../../modules/ota/ports.ts';
import { InvalidInputError } from '../../../../shared/errors.ts';
import type { DatabaseHealth } from '../aouerj/status.ts';
import type { ApiError } from '../contract.ts';
import { perMinuteLimit, requireDatabase } from '../middleware.ts';
import { body, parse, stringFor } from '../validation.ts';
import { multipartMixed, type Part } from './multipart.ts';

/** A resposta ao envio de um arquivo. */
export type OtaAssetResponse = {
  status: 'created' | 'exists';
  hash: string;
  /** O tipo guardado (o do primeiro envio). */
  contentType: string;
  size: number;
};

/** A resposta a uma publicação: gravada agora (201) ou já estava lá (200). */
export type OtaPublicationResponse = {
  status: 'published' | 'already_published';
  kind: OtaEntryKind;
  platform: OtaPlatform;
  runtimeVersion: string;
  updateId: string | null;
  commitTime: string;
  publishedAt: string;
};

/**
 * O corpo de uma publicação: o texto (até 512 K caracteres, que o JSON ainda
 * escapa) e a assinatura.
 */
const PUBLISH_JSON_LIMIT = '2mb';

const ENCODINGS = ['br', 'gzip'] as const satisfies readonly AssetEncoding[];

/** O manifesto e as diretivas vão como `application/json`, com a assinatura. */
const EXTENSIONS = JSON.stringify({ assetRequestHeaders: {} });

const send = (res: Response, status: number, error: ApiError) => {
  res.status(status).json(error);
};

const platformField = z.enum(OTA_PLATFORMS, {
  error: issue =>
    issue.input === undefined
      ? 'platform is required'
      : 'platform must be android or ios',
});

const runtimeField = stringFor('runtimeVersion').refine(
  isRuntimeVersion,
  'runtimeVersion must be 1 to 255 visible ASCII characters',
);

const textField = (field: string, max: number) =>
  stringFor(field)
    .min(1, `${field} is required`)
    .max(max, `${field} must be at most ${max} characters`);

const updateSchema = body({
  platform: platformField,
  runtimeVersion: runtimeField,
  manifest: textField('manifest', OTA_LIMITS.manifest),
  signature: textField('signature', OTA_LIMITS.signature),
});

const directiveSchema = body({
  platform: platformField,
  runtimeVersion: runtimeField,
  directive: textField('directive', OTA_LIMITS.directive),
  signature: textField('signature', OTA_LIMITS.signature),
});

/** O `expo-signature`: um dicionário de Structured Field Values (RFC 8941). */
const signatureHeader = (signature: string) =>
  `sig="${signature}", keyid="${OTA_KEY_ID}"`;

const signedPart = (name: string, text: string, signature: string): Part => ({
  name,
  contentType: 'application/json',
  headers: { 'expo-signature': signatureHeader(signature) },
  body: text,
});

/**
 * A resposta do protocolo 1: o manifesto (com as extensões) ou a diretiva,
 * em `multipart/mixed`, cada um com a assinatura do CI. "Nada novo" sem a
 * assinatura pronta é um 204, que o protocolo 1 aceita como "nada a fazer".
 */
function sendAnswer(res: Response, answer: OtaAnswer) {
  let parts: Part[];
  if (answer.kind === 'manifest') {
    parts = [
      signedPart('manifest', answer.body, answer.signature),
      { name: 'extensions', contentType: 'application/json', body: EXTENSIONS },
    ];
  } else {
    const { signature } = answer;
    if (signature === null) {
      res.status(204).end();
      return;
    }
    parts = [signedPart('directive', answer.body, signature)];
  }
  const { contentType, body: payload } = multipartMixed(parts);
  // setHeader, não res.set: o Express acrescentaria um charset
  res.status(200);
  res.setHeader('content-type', contentType);
  res.setHeader('content-length', payload.length);
  res.end(payload);
}

/**
 * O pedido do app. O protocolo 1 pede 406 a um cliente de outra versão ou
 * que não aceita `multipart/mixed`, e 400 a uma plataforma desconhecida.
 */
const manifestRequest: RequestHandler = (req, res, next) => {
  if (req.get('expo-protocol-version') !== '1') {
    send(res, 406, {
      error: 'unsupported_protocol',
      message: 'Only version 1 of the expo-updates protocol is supported',
    });
    return;
  }
  if (!req.accepts('multipart/mixed')) {
    send(res, 406, {
      error: 'not_acceptable',
      message: 'The answer is multipart/mixed',
    });
    return;
  }
  const platform = req.get('expo-platform');
  if (!isOtaPlatform(platform))
    throw new InvalidInputError('expo-platform must be android or ios');
  const runtimeVersion = req.get('expo-runtime-version');
  if (!runtimeVersion || !isRuntimeVersion(runtimeVersion))
    throw new InvalidInputError(
      'expo-runtime-version is required: 1 to 255 visible ASCII characters',
    );
  res.locals.otaRequest = {
    platform,
    runtimeVersion,
    currentUpdateId: updateIdOf(req.get('expo-current-update-id')),
  } satisfies OtaRequest;
  next();
};

/** Os cabeçalhos do protocolo em toda resposta do manifesto, até nos erros. */
const protocolHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('expo-protocol-version', '1');
  res.setHeader('expo-sfv-version', '0');
  res.setHeader('cache-control', 'private, max-age=0');
  next();
};

/** O hash do caminho (`:hash`); um texto só, nunca uma lista. */
function hashOf(req: Request): string {
  const { hash } = req.params;
  return typeof hash === 'string' ? hash : '';
}

/** A versão comprimida que o app aceita; sem `accept-encoding`, o original. */
function encodingFor(
  req: Request,
  asset: StoredOtaAsset,
): AssetEncoding | null {
  if (!req.get('accept-encoding')) return null;
  const offered = ENCODINGS.filter(
    encoding => asset.encodings[encoding] !== undefined,
  );
  if (!offered.length) return null;
  const chosen = req.acceptsEncodings(...offered, 'identity');
  return chosen === 'br' || chosen === 'gzip' ? chosen : null;
}

const toPublicationResponse = ({
  created,
  entry,
}: OtaPublication): OtaPublicationResponse => ({
  status: created ? 'published' : 'already_published',
  kind: entry.kind,
  platform: entry.platform,
  runtimeVersion: entry.runtimeVersion,
  updateId: entry.updateId,
  commitTime: entry.commitTime.toISOString(),
  publishedAt: entry.publishedAt.toISOString(),
});

/**
 * As atualizações pelo ar, em `/aouerj/ota`: o que o expo-updates do app
 * pede (o manifesto e os arquivos) e o que o CI publica, cada envio com a
 * assinatura do code signing (a única credencial). Montado antes de
 * `/aouerj`, com os próprios corpos: um arquivo não passa pelo JSON de lá.
 */
export function createOtaRouter({
  ota,
  database,
  assetLimitBytes,
  publishPerMinute,
  manifestPerMinute,
}: {
  ota: OtaUpdates;
  database: DatabaseHealth;
  /** O maior arquivo que um envio aceita (413 acima). */
  assetLimitBytes: number;
  /** Por IP, por minuto: os envios e as publicações, juntos. */
  publishPerMinute: number;
  /** Por IP, por minuto: as perguntas pelo manifesto. */
  manifestPerMinute: number;
}) {
  const withDatabase = requireDatabase(() => database.isReady());
  const publishLimit = perMinuteLimit(publishPerMinute);
  const manifestLimit = perMinuteLimit(manifestPerMinute);
  const publishJson = express.json({ limit: PUBLISH_JSON_LIMIT });
  const routes = express.Router();

  // sem o banco, 503: o app trata como uma falha e segue com o JS que tem
  routes.get(
    '/manifest',
    protocolHeaders,
    manifestLimit,
    manifestRequest,
    withDatabase,
    async (req, res) => {
      const request = res.locals.otaRequest as OtaRequest;
      sendAnswer(res, await ota.check(request));
    },
  );

  // os arquivos não dependem do banco, nem têm limite: uma atualização baixa
  // vários de uma vez, e o Wi-Fi da UERJ põe muitos alunos num IP só
  routes.get('/assets/:hash', async (req, res) => {
    const asset = await ota.asset(hashOf(req));
    if (!asset) {
      // o arquivo pode chegar depois: o 404 não fica guardado
      res.setHeader('cache-control', 'no-store');
      send(res, 404, {
        error: 'asset_not_found',
        message: 'No file with this hash',
      });
      return;
    }
    const encoding = encodingFor(req, asset);
    res.setHeader('content-type', asset.contentType);
    res.setHeader(
      'content-length',
      encoding ? (asset.encodings[encoding] ?? asset.size) : asset.size,
    );
    // o endereço é o hash do conteúdo: nunca muda
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.setHeader('etag', `"${asset.hash}${encoding ? `-${encoding}` : ''}"`);
    res.setHeader('vary', 'accept-encoding');
    // um arquivo é dado, não página: nada roda nesta origem, nem por engano
    res.setHeader('content-security-policy', "default-src 'none'; sandbox");
    if (encoding) res.setHeader('content-encoding', encoding);
    if (req.fresh) {
      res.status(304).end();
      return;
    }
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    try {
      await pipeline(asset.open(encoding), res);
    } catch {
      // o app desistiu no meio (ou o arquivo saiu na limpeza): a conexão já
      // foi fechada, e não há resposta de erro a dar
    }
  });

  // a assinatura e o tipo antes de ler o corpo: um envio sem a chave não
  // ocupa a memória
  routes.put(
    '/assets/:hash',
    publishLimit,
    (req, res, next) => {
      ota.authorizeAsset({
        hash: hashOf(req),
        signature: req.get('expo-ota-signature'),
        contentType: req.get('content-type'),
      });
      next();
    },
    express.raw({ type: () => true, limit: assetLimitBytes }),
    async (req, res) => {
      const content: unknown = req.body;
      const { created, asset } = await ota.uploadAsset({
        hash: hashOf(req),
        signature: req.get('expo-ota-signature'),
        contentType: req.get('content-type'),
        content: Buffer.isBuffer(content) ? content : Buffer.alloc(0),
      });
      res.status(created ? 201 : 200).json({
        status: created ? 'created' : 'exists',
        hash: asset.hash,
        contentType: asset.contentType,
        size: asset.size,
      } satisfies OtaAssetResponse);
    },
  );

  routes.post(
    '/updates',
    publishLimit,
    publishJson,
    withDatabase,
    async (req, res) => {
      const published = await ota.publishUpdate(parse(updateSchema, req.body));
      res
        .status(published.created ? 201 : 200)
        .json(toPublicationResponse(published));
    },
  );

  routes.post(
    '/directives',
    publishLimit,
    publishJson,
    withDatabase,
    async (req, res) => {
      const published = await ota.publishDirective(
        parse(directiveSchema, req.body),
      );
      res
        .status(published.created ? 201 : 200)
        .json(toPublicationResponse(published));
    },
  );

  return routes;
}
