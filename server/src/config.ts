import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import type { ServiceAccount } from './adapters/outbound/attestation/playIntegrity.ts';
import {
  issuerKey,
  signingKey,
  type IssuerKey,
} from './modules/access/domain.ts';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true');

const milliseconds = (fallback: number, minimum = 1) =>
  z.coerce.number().int().min(minimum).default(fallback);

/**
 * `TRUST_PROXY` como o Express espera: saltos ("1"), `true`, `false` ou a
 * lista de endereços. Um "1" em texto viraria um endereço inválido.
 */
const trustProxy = z
  .string()
  .optional()
  .transform(value => {
    if (value === undefined || value === '') return undefined;
    if (/^\d+$/.test(value)) return Number(value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });

/** Um nome de servidor como o Privacy Pass o usa: host e porta opcional. */
const serverName = z
  .string()
  .regex(/^[a-z0-9.-]+(:\d+)?$/i, 'must be a server name, like pitrol.dev');

const parses = (read: () => unknown) => {
  try {
    read();
    return true;
  } catch {
    return false;
  }
};

/** Uma chave privada (PKCS #8), que também assina, ou só a pública (SPKI). */
function keyFromDer(der: Buffer, notAfter: Date): IssuerKey {
  if (
    parses(() => createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }))
  )
    return signingKey(der, notAfter);
  if (parses(() => createPublicKey({ key: der, format: 'der', type: 'spki' })))
    return issuerKey(der, notAfter);
  throw new Error('expected an SPKI public key or a PKCS #8 private key');
}

/**
 * As chaves do emissor dos tokens de aluno, separadas por vírgula:
 * `<DER em base64>@<AAAA-MM-DD>`, a data (00:00 UTC) em que a chave deixa de
 * valer. A chave privada (PKCS #8, RSA comum) resgata e emite; a pública
 * (SPKI) só resgata, para uma chave antiga cuja privada já foi descartada. Cada uma é conferida aqui: uma chave errada não deixa o
 * servidor subir.
 */
const tokenKeys = z
  .string()
  .optional()
  .transform((value, ctx): IssuerKey[] => {
    const keys: IssuerKey[] = [];
    const entries = (value ?? '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
    entries.forEach((entry, index) => {
      const at = entry.lastIndexOf('@');
      const der = entry.slice(0, at);
      const date = entry.slice(at + 1);
      const fail = (message: string) =>
        ctx.addIssue({
          code: 'custom',
          message: `key ${index + 1}: ${message}`,
        });
      if (at === -1 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(der)) {
        fail('expected <base64 DER key>@<YYYY-MM-DD>');
        return;
      }
      const notAfter = new Date(`${date}T00:00:00Z`);
      // o Date aceita 30 de fevereiro e passa para março: a volta confere
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(notAfter.getTime()) ||
        notAfter.toISOString().slice(0, 10) !== date
      ) {
        fail('the expiry must be a date, YYYY-MM-DD');
        return;
      }
      try {
        keys.push(keyFromDer(Buffer.from(der, 'base64'), notAfter));
      } catch (err) {
        fail(err instanceof Error ? err.message : 'invalid key');
      }
    });
    return keys;
  });

/**
 * O JSON da conta de serviço do Google (a chave baixada do Cloud Console),
 * lido na partida: um arquivo ilegível não deixa o servidor subir.
 */
const serviceAccountFile = z
  .string()
  .optional()
  .transform((file, ctx): ServiceAccount | undefined => {
    if (!file) return undefined;
    const fail = (message: string) => {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    };
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return fail(`cannot read the service account JSON at ${file}`);
    }
    const fields = z
      .object({
        type: z.literal('service_account'),
        client_email: z.string().min(1),
        private_key: z.string().min(1),
      })
      .safeParse(json);
    if (!fields.success)
      return fail(
        'not a service account key (type, client_email and private_key)',
      );
    try {
      return {
        clientEmail: fields.data.client_email,
        privateKey: createPrivateKey(fields.data.private_key),
      };
    } catch {
      return fail('the private_key of the service account is not readable');
    }
  });

/**
 * As impressões SHA-256 dos certificados que assinam o app na Play, como o
 * Play Console as mostra (`AB:CD:…`), separadas por vírgula.
 */
const certificateDigests = z
  .string()
  .optional()
  .transform((value, ctx) =>
    (value ?? '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .flatMap((entry, index) => {
        const hex = entry.replace(/:/g, '');
        if (/^[0-9a-f]{64}$/i.test(hex)) return [Buffer.from(hex, 'hex')];
        ctx.addIssue({
          code: 'custom',
          message: `certificate ${index + 1}: expected a SHA-256 fingerprint in hex, like AB:CD:…`,
        });
        return [];
      }),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3300),
    /** Na produção, 127.0.0.1: só o nginx chega ao processo. */
    HOST: z.string().min(1).optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .optional(),

    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/aouerj'),
    MONGODB_TIMEOUT_MS: milliseconds(5000),
    MONGODB_AUTO_INDEX: z
      .enum(['true', 'false'])
      .default('true')
      .transform(value => value === 'true'),

    // o corpo de /aouerj, como no servidor antigo: um relato dos apps 1.x traz
    // a página do portal, e o limite não deixa guardar mais do que antes
    JSON_LIMIT: z.string().min(1).default('100kb'),
    // o pedido ao gerador (o antigo aceitava 16 MB; o app manda uns 15 KB)
    GENERATOR_JSON_LIMIT: z.string().min(1).default('1mb'),
    CACHE_TTL_MS: milliseconds(5 * 60 * 1000, 1000),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
    REPORTS_DIR: z.string().min(1).optional(),
    ADMIN_TOKEN: z
      .string()
      .min(16, 'ADMIN_TOKEN must have at least 16 characters')
      .optional(),

    FORCE_HTTPS: flag,
    PUBLIC_URL: z.url({ protocol: /^https$/ }).optional(),
    TRUST_PROXY: trustProxy,

    PORTAL_MONITOR: z.enum(['on', 'off']).default('on'),
    PORTAL_MONITOR_INTERVAL_MS: milliseconds(5 * 60 * 1000, 1000),

    /** A implantação (deploy/server/release.sh) diz qual commit e cor sobe. */
    RELEASE_COMMIT: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/, 'RELEASE_COMMIT must be a git commit hash')
      .optional(),
    RELEASE_COLOR: z.enum(['blue', 'green']).optional(),

    GENERATOR_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(1),
    GENERATOR_QUEUE_LIMIT: z.coerce.number().int().min(0).max(100).default(32),
    GENERATOR_BUDGET_MS: milliseconds(10000, 100).pipe(
      z.number().max(60000, 'GENERATOR_BUDGET_MS must be at most 60000'),
    ),
    GENERATOR_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .min(1)
      .default(120),

    /** O acesso de aluno da API v2 (Privacy Pass); sem chave, a v2 dá 503. */
    PRIVATE_TOKEN_KEYS: tokenKeys,
    PRIVATE_TOKEN_ISSUER: serverName.default('pitrol.dev'),
    PRIVATE_TOKEN_ORIGIN: serverName.default('pitrol.dev'),

    /** Quem atesta o app na emissão; `development` aceita qualquer um. */
    TOKEN_ATTESTATION: z
      .enum(['play-integrity', 'development'])
      .default('play-integrity'),
    PLAY_INTEGRITY_SERVICE_ACCOUNT: serviceAccountFile,
    PLAY_INTEGRITY_PACKAGE: z
      .string()
      .regex(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/, 'must be an Android package')
      .default('com.aouerjmobile'),
    PLAY_INTEGRITY_CERT_SHA256: certificateDigests,
    TOKEN_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(32),
    TOKEN_BATCHES_PER_DAY: z.coerce.number().int().min(1).max(100).default(4),
    TOKEN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  })
  // o emulador e o debug não passam na Play Integrity; a produção, sim
  .refine(
    env =>
      env.TOKEN_ATTESTATION !== 'development' || env.NODE_ENV !== 'production',
    {
      message: 'TOKEN_ATTESTATION=development is not allowed in production',
      path: ['TOKEN_ATTESTATION'],
    },
  )
  // sem o certificado, um app reempacotado com outra assinatura passaria
  .refine(
    env =>
      !env.PLAY_INTEGRITY_SERVICE_ACCOUNT ||
      env.PLAY_INTEGRITY_CERT_SHA256.length > 0,
    {
      message:
        'PLAY_INTEGRITY_CERT_SHA256 is required with PLAY_INTEGRITY_SERVICE_ACCOUNT',
      path: ['PLAY_INTEGRITY_CERT_SHA256'],
    },
  )
  .refine(env => !env.FORCE_HTTPS || env.PUBLIC_URL, {
    message: 'PUBLIC_URL (https) is required when FORCE_HTTPS is true',
    path: ['PUBLIC_URL'],
  })
  // sem um proxy confiável, `req.secure` nunca é verdadeiro e toda
  // requisição voltaria para ela mesma (um 308 sem fim)
  .refine(
    env =>
      !env.FORCE_HTTPS ||
      (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== false),
    {
      message: 'TRUST_PROXY is required when FORCE_HTTPS is true',
      path: ['TRUST_PROXY'],
    },
  );

/** A configuração do servidor, lida e conferida uma vez, na partida. */
export type Config = {
  env: 'development' | 'production' | 'test';
  port: number;
  /** Sem valor, todas as interfaces. */
  host: string | undefined;
  logLevel: string;
  mongo: {
    uri: string;
    timeoutMs: number;
    /** Cria os índices na partida (o Mongoose faz isso por padrão). */
    autoIndex: boolean;
  };
  http: {
    /** O corpo das rotas de /aouerj. */
    jsonLimit: string;
    /** O corpo das rotas de /schedules. */
    generatorJsonLimit: string;
    /** Por IP, por minuto: as gravações juntas. */
    rateLimitPerMinute: number;
    forceHttps: boolean;
    publicUrl: string | undefined;
    trustProxy: number | boolean | string | undefined;
    /** Libera as listagens com e-mail (`Authorization: Bearer`). */
    adminToken: string | undefined;
  };
  teachersCacheMs: number;
  reportsDir: string;
  portalMonitor: { enabled: boolean; intervalMs: number };
  /** O que está no ar, para o `GET /aouerj/status`. */
  release: { commit: string | null; color: 'blue' | 'green' | null };
  generator: {
    /** Buscas ao mesmo tempo, cada uma numa thread. */
    concurrency: number;
    /** Quantas esperam a vez; além disso, 503. */
    queueLimit: number;
    /** Quanto uma busca roda antes de devolver o melhor que achou. */
    budgetMs: number;
    /** Por IP, por minuto. */
    perMinute: number;
  };
  /** O acesso de aluno da API v2: quem emite, onde vale e as chaves. */
  studentAccess: {
    issuer: string;
    origin: string;
    keys: IssuerKey[];
    issuance: {
      /** `null`: sem conta de serviço, não há emissão (o resgate continua). */
      attestation: AttestationSettings | null;
      /** Tokens por lote. */
      batchSize: number;
      /** Lotes por instalação por dia (UTC). */
      batchesPerDay: number;
      /** Por IP, por minuto: os desafios e os lotes juntos. */
      perMinute: number;
    };
  };
};

/** Quem atesta o app na emissão dos tokens. */
export type AttestationSettings =
  | { mode: 'development' }
  | {
      mode: 'play-integrity';
      account: ServiceAccount;
      packageName: string;
      certificateDigests: Buffer[];
    };

/** O diretório do pacote (server/), onde ficam os anexos por padrão. */
const SERVER_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Lê o ambiente. Um valor inválido para a partida com a lista do que está
 * errado: melhor que descobrir numa requisição.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map(issue => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const value = parsed.data;
  return {
    env: value.NODE_ENV,
    port: value.PORT,
    host: value.HOST,
    logLevel:
      value.LOG_LEVEL ?? (value.NODE_ENV === 'test' ? 'silent' : 'info'),
    mongo: {
      uri: value.MONGODB_URI,
      timeoutMs: value.MONGODB_TIMEOUT_MS,
      autoIndex: value.MONGODB_AUTO_INDEX,
    },
    http: {
      jsonLimit: value.JSON_LIMIT,
      generatorJsonLimit: value.GENERATOR_JSON_LIMIT,
      rateLimitPerMinute: value.RATE_LIMIT_PER_MINUTE,
      forceHttps: value.FORCE_HTTPS,
      publicUrl: value.PUBLIC_URL,
      trustProxy: value.TRUST_PROXY,
      adminToken: value.ADMIN_TOKEN,
    },
    teachersCacheMs: value.CACHE_TTL_MS,
    reportsDir: value.REPORTS_DIR ?? path.join(SERVER_ROOT, 'AOreports'),
    portalMonitor: {
      enabled: value.PORTAL_MONITOR === 'on' && value.NODE_ENV !== 'test',
      intervalMs: value.PORTAL_MONITOR_INTERVAL_MS,
    },
    release: {
      commit: value.RELEASE_COMMIT ?? null,
      color: value.RELEASE_COLOR ?? null,
    },
    generator: {
      concurrency: value.GENERATOR_CONCURRENCY,
      queueLimit: value.GENERATOR_QUEUE_LIMIT,
      budgetMs: value.GENERATOR_BUDGET_MS,
      perMinute: value.GENERATOR_RATE_LIMIT_PER_MINUTE,
    },
    studentAccess: {
      issuer: value.PRIVATE_TOKEN_ISSUER,
      origin: value.PRIVATE_TOKEN_ORIGIN,
      keys: value.PRIVATE_TOKEN_KEYS,
      issuance: {
        attestation: attestationOf(value),
        batchSize: value.TOKEN_BATCH_SIZE,
        batchesPerDay: value.TOKEN_BATCHES_PER_DAY,
        perMinute: value.TOKEN_RATE_LIMIT_PER_MINUTE,
      },
    },
  };
}

function attestationOf(
  value: z.infer<typeof EnvSchema>,
): AttestationSettings | null {
  if (value.TOKEN_ATTESTATION === 'development') return { mode: 'development' };
  if (!value.PLAY_INTEGRITY_SERVICE_ACCOUNT) return null;
  return {
    mode: 'play-integrity',
    account: value.PLAY_INTEGRITY_SERVICE_ACCOUNT,
    packageName: value.PLAY_INTEGRITY_PACKAGE,
    certificateDigests: value.PLAY_INTEGRITY_CERT_SHA256,
  };
}
