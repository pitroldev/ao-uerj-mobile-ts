import { fromBase64 } from './bytes';
import { tokenKeyId } from './privateToken';

/*
 * O estoque de tokens no aparelho. O app pede um lote de uma vez e em
 * segundo plano, nunca logo antes de uma ação: emissão e uso não ficam
 * colados no tempo. Cada token vale uma requisição.
 */

/** Tokens por lote: o máximo que o servidor assina de uma vez (TOKEN_BATCH_SIZE). */
export const BATCH_SIZE = 32;
/** Abaixo disto, o app pede outro lote. */
const REFILL_BELOW = 10;
/** O estoque não passa de dois lotes. */
const MAX_TOKENS = 2 * BATCH_SIZE;

const HOUR = 60 * 60 * 1000;
/** Rede, Play ou servidor fora do ar, chave ainda não publicada: tenta de novo depois. */
export const RETRY_TRANSIENT_MS = HOUR;
/** O aparelho ou o app não passou na atestação: não insiste no mesmo dia. */
export const RETRY_REFUSED_MS = 24 * HOUR;

export type TokenStock = {
  /** Tokens prontos, em base64url, do mais antigo ao mais novo. */
  tokens: string[];
  /** Antes disto (epoch ms), o app não pede outro lote. */
  retryAt: number | null;
};

export const EMPTY_STOCK: TokenStock = { tokens: [], retryAt: null };

/** O id (hex) da chave de um token guardado; `null` se não for um token. */
function storedKeyId(token: string): string | null {
  const bytes = fromBase64(token);
  return bytes ? tokenKeyId(bytes) : null;
}

/** O estoque salvo, ou `null` se o formato não for este. */
export function parseTokenStock(raw: unknown): TokenStock | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return null;
  const { tokens, retryAt } = raw as Record<string, unknown>;
  if (!Array.isArray(tokens)) return null;
  if (
    retryAt !== null &&
    (typeof retryAt !== 'number' || !Number.isFinite(retryAt))
  )
    return null;
  return {
    tokens: tokens
      .filter((token): token is string => typeof token === 'string')
      .filter(token => storedKeyId(token) !== null)
      .slice(-MAX_TOKENS),
    retryAt,
  };
}

/**
 * Só os tokens das chaves aceitas: o aviso remoto tira a chave que sai de
 * uso, e os tokens dela não valeriam mais no servidor.
 */
export function keepKeys(
  stock: TokenStock,
  allowed: readonly string[],
): TokenStock {
  const tokens = stock.tokens.filter(token =>
    allowed.includes(storedKeyId(token) ?? ''),
  );
  return tokens.length === stock.tokens.length ? stock : { ...stock, tokens };
}

export const needsRefill = (stock: TokenStock) =>
  stock.tokens.length < REFILL_BELOW;

/** Um lote novo entra no fim; sem limite de espera daí em diante. */
export const addTokens = (stock: TokenStock, tokens: readonly string[]) => ({
  tokens: [...stock.tokens, ...tokens].slice(-MAX_TOKENS),
  retryAt: null,
});

/** O próximo token: o mais antigo, cuja chave vence primeiro. */
export function takeToken(
  stock: TokenStock,
): { token: string; stock: TokenStock } | null {
  const [token, ...rest] = stock.tokens;
  return token === undefined
    ? null
    : { token, stock: { ...stock, tokens: rest } };
}

/** A próxima meia-noite UTC: quando o limite diário do servidor recomeça. */
export function nextUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}
