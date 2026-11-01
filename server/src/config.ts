import path from 'node:path';

import { z } from 'zod';

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
  })
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
  };
}
