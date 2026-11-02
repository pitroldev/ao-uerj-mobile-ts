import { testCrypto, testIssuer } from '../../__tests__/testCrypto';
import { toBase64 } from '../bytes';
import {
  blindToken,
  encodeChallenge,
  finalizeToken,
  parseTokenKey,
} from '../privateToken';
import {
  addTokens,
  EMPTY_STOCK,
  keepKeys,
  needsRefill,
  nextUtcDay,
  parseTokenStock,
  takeToken,
} from '../tokenStock';

function tokensOf(issuer: ReturnType<typeof testIssuer>, count: number) {
  const key = parseTokenKey(testCrypto, issuer.tokenKey)!;
  return Array.from({ length: count }, () => {
    const blinded = blindToken(testCrypto, key, encodeChallenge());
    const token = finalizeToken(
      testCrypto,
      key,
      blinded,
      issuer.sign(blinded.request),
    )!;
    return toBase64(token, { url: true });
  });
}

const issuer = testIssuer();
const other = testIssuer();
const [first, second, third] = tokensOf(issuer, 3);
const [foreign] = tokensOf(other, 1);

it('gives out the oldest token first, once', () => {
  const stock = addTokens(EMPTY_STOCK, [first, second]);
  const taken = takeToken(stock)!;
  expect(taken.token).toBe(first);
  expect(taken.stock.tokens).toEqual([second]);
  expect(takeToken(EMPTY_STOCK)).toBeNull();
});

it('asks for a batch below ten tokens and keeps at most two batches', () => {
  expect(needsRefill(EMPTY_STOCK)).toBe(true);
  const many = Array.from({ length: 70 }, () => first);
  const full = addTokens({ tokens: [], retryAt: 123 }, many);
  expect(full.tokens).toHaveLength(64);
  expect(full.retryAt).toBeNull();
  expect(needsRefill(full)).toBe(false);
  expect(needsRefill({ tokens: many.slice(0, 9), retryAt: null })).toBe(true);
  expect(needsRefill({ tokens: many.slice(0, 10), retryAt: null })).toBe(false);
});

it('drops the tokens of keys the remote notice no longer lists', () => {
  const stock = addTokens(EMPTY_STOCK, [first, foreign, second]);
  expect(keepKeys(stock, [issuer.keyId]).tokens).toEqual([first, second]);
  expect(keepKeys(stock, [issuer.keyId, other.keyId])).toBe(stock);
  expect(keepKeys(stock, []).tokens).toEqual([]);
});

it('reads back only a well-formed stock, without stray values', () => {
  expect(
    parseTokenStock({ tokens: [first, 'lixo', 42, third], retryAt: null }),
  ).toEqual({
    tokens: [first, third],
    retryAt: null,
  });
  expect(parseTokenStock({ tokens: [], retryAt: 1700000000000 })).toEqual({
    tokens: [],
    retryAt: 1700000000000,
  });
  for (const raw of [
    null,
    [],
    { tokens: 'x', retryAt: null },
    { tokens: [], retryAt: 'amanhã' },
    { tokens: [] },
  ])
    expect(parseTokenStock(raw)).toBeNull();
});

it('waits for the next UTC midnight when the daily limit is reached', () => {
  expect(nextUtcDay(Date.UTC(2026, 10, 2, 23, 59))).toBe(Date.UTC(2026, 10, 3));
  expect(nextUtcDay(Date.UTC(2026, 11, 31, 0, 0))).toBe(Date.UTC(2027, 0, 1));
});
