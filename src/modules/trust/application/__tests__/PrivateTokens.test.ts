import { testCrypto, testIssuer } from '../../__tests__/testCrypto';
import { fromBase64, toHex } from '../../domain/bytes';
import { tokenKeyId } from '../../domain/privateToken';
import {
  RETRY_REFUSED_MS,
  RETRY_TRANSIENT_MS,
  type TokenStock,
} from '../../domain/tokenStock';
import type {
  Attestation,
  DeviceTrustPort,
  Issuance,
  IssuanceRequest,
  TokenIssuerPort,
  TokenStorePort,
} from '../ports';
import { PrivateTokens } from '../PrivateTokens';

const NOW = Date.UTC(2026, 10, 2, 15);
const issuerKey = testIssuer();

function memoryStore(initial: TokenStock | null = null) {
  const state = { stock: initial, installation: null as string | null };
  const store: TokenStorePort = {
    readStock: async () => state.stock,
    writeStock: async stock => {
      state.stock = stock;
    },
    readInstallation: async () => state.installation,
    writeInstallation: async installation => {
      state.installation = installation;
    },
  };
  return { store, state };
}

/** O emissor de verdade em miniatura: um desafio por vez e a assinatura cega. */
function fakeIssuer(key = issuerKey) {
  let counter = 0;
  const requests: IssuanceRequest[] = [];
  const refusals: Issuance[] = [];
  const issuer: jest.Mocked<TokenIssuerPort> = {
    challenge: jest.fn(async () => ({
      challenge: new Uint8Array(36).fill(++counter),
      tokenKey: key.tokenKey,
    })),
    issue: jest.fn(async request => {
      requests.push(request);
      const refusal = refusals.shift();
      if (refusal) return refusal;
      return {
        issued: true as const,
        tokenKey: key.tokenKey,
        tokenResponses: request.tokenRequests.map(key.sign),
      };
    }),
  };
  return { issuer, requests, refusals };
}

function fakeDevice(attestation: Attestation = { token: 'integrity' }) {
  const hashes: string[] = [];
  const device: DeviceTrustPort = {
    crypto: testCrypto,
    attest: jest.fn(async requestHash => {
      hashes.push(requestHash);
      return attestation;
    }),
  };
  return { device, hashes };
}

function setup({
  allowed = [issuerKey.keyId] as string[] | null,
  stock = null as TokenStock | null,
  attestation = undefined as Attestation | undefined,
} = {}) {
  const { issuer, requests, refusals } = fakeIssuer();
  const { device, hashes } = fakeDevice(attestation);
  const { store, state } = memoryStore(stock);
  let now = NOW;
  let keys = allowed;
  const tokens = new PrivateTokens({
    issuer,
    device,
    store,
    allowedKeys: () => keys,
    now: () => now,
  });
  return {
    tokens,
    issuer,
    device,
    requests,
    refusals,
    hashes,
    state,
    advance: (ms: number) => {
      now += ms;
    },
    setKeys: (next: string[] | null) => {
      keys = next;
    },
  };
}

it('fills the stock with a batch of 32 tokens that the issuer key signed', async () => {
  const { tokens, requests, hashes, state } = setup();
  await expect(tokens.refill()).resolves.toBe('refilled');
  expect(state.stock?.tokens).toHaveLength(32);
  expect(state.stock?.retryAt).toBeNull();
  expect(requests).toHaveLength(1);
  const [request] = requests;
  expect(request.tokenRequests).toHaveLength(32);
  expect(request.integrityToken).toBe('integrity');
  // a atestação cobre este lote: o hash é o do desafio, da instalação e dos pedidos
  expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
  for (const token of state.stock!.tokens)
    expect(tokenKeyId(fromBase64(token)!)).toBe(issuerKey.keyId);
  // a instalação: 32 bytes, criados uma vez e mandados no pedido
  expect(fromBase64(state.installation!)).toEqual(request.installation);
  expect(request.installation).toHaveLength(32);
});

it('gives out each token once and asks for more only below ten', async () => {
  const { tokens, issuer } = setup();
  await tokens.refill();
  const first = await tokens.take();
  const second = await tokens.take();
  expect(first).toMatch(/^PrivateToken token="[A-Za-z0-9_-]+=*"$/);
  expect(second).not.toBe(first);
  await expect(tokens.count()).resolves.toBe(30);

  await expect(tokens.refill()).resolves.toBe('enough');
  expect(issuer.challenge).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 21; i++) await tokens.take();
  await expect(tokens.count()).resolves.toBe(9);
  await expect(tokens.refill()).resolves.toBe('refilled');
  await expect(tokens.count()).resolves.toBe(41);
});

it('keeps the same installation id across batches and after the logout', async () => {
  const { tokens, requests } = setup();
  await tokens.refill();
  await tokens.clear();
  await expect(tokens.count()).resolves.toBe(0);
  await expect(tokens.take()).resolves.toBeNull();
  await tokens.refill();
  expect(requests).toHaveLength(2);
  expect(requests[1].installation).toEqual(requests[0].installation);
});

it('asks nothing without the device, the store or the published keys', async () => {
  const { issuer } = fakeIssuer();
  const { store } = memoryStore();
  const { device } = fakeDevice();
  const allowedKeys = () => [issuerKey.keyId];
  const now = () => NOW;
  await expect(
    new PrivateTokens({
      issuer,
      device: null,
      store,
      allowedKeys,
      now,
    }).refill(),
  ).resolves.toBe('unsupported');
  await expect(
    new PrivateTokens({
      issuer,
      device,
      store: null,
      allowedKeys,
      now,
    }).refill(),
  ).resolves.toBe('unsupported');
  for (const keys of [null, []]) {
    const { tokens, issuer: other } = setup({ allowed: keys });
    await expect(tokens.refill()).resolves.toBe('no-keys');
    expect(other.challenge).not.toHaveBeenCalled();
  }
  expect(issuer.challenge).not.toHaveBeenCalled();
});

it('refuses a key that the remote notice does not list, and waits', async () => {
  const { tokens, issuer, device, state, advance, setKeys } = setup({
    allowed: [toHex(new Uint8Array(32))],
  });
  await expect(tokens.refill()).resolves.toBe('failed');
  // nada vai à Play nem ao emissor com uma chave que pode ser só deste aluno
  expect(device.attest).not.toHaveBeenCalled();
  expect(issuer.issue).not.toHaveBeenCalled();
  expect(state.stock?.retryAt).toBe(NOW + RETRY_TRANSIENT_MS);

  setKeys([issuerKey.keyId]);
  await expect(tokens.refill()).resolves.toBe('waiting');
  advance(RETRY_TRANSIENT_MS);
  await expect(tokens.refill()).resolves.toBe('refilled');
});

it('drops the tokens of a key that leaves the remote notice', async () => {
  const { tokens, setKeys, state } = setup();
  await tokens.refill();
  setKeys([toHex(new Uint8Array(32)), issuerKey.keyId]);
  await expect(tokens.count()).resolves.toBe(32);
  setKeys([toHex(new Uint8Array(32))]);
  await expect(tokens.take()).resolves.toBeNull();
  expect(state.stock?.tokens).toEqual([]);
});

it('gets a new challenge once when the first one expired', async () => {
  const { tokens, refusals, requests, issuer } = setup();
  refusals.push({ issued: false, refusal: 'invalid_challenge' });
  await expect(tokens.refill()).resolves.toBe('refilled');
  expect(issuer.challenge).toHaveBeenCalledTimes(2);
  expect(requests[1].challenge).not.toEqual(requests[0].challenge);

  const second = setup();
  second.refusals.push(
    { issued: false, refusal: 'invalid_token_request' },
    { issued: false, refusal: 'invalid_token_request' },
  );
  await expect(second.tokens.refill()).resolves.toBe('failed');
  expect(second.issuer.challenge).toHaveBeenCalledTimes(2);
  expect(second.state.stock?.retryAt).toBe(NOW + RETRY_TRANSIENT_MS);
});

it('waits a day after a failed attestation and until the server says after the limit', async () => {
  const refused = setup();
  refused.refusals.push({ issued: false, refusal: 'attestation_failed' });
  await expect(refused.tokens.refill()).resolves.toBe('failed');
  expect(refused.state.stock?.retryAt).toBe(NOW + RETRY_REFUSED_MS);

  const limited = setup();
  limited.refusals.push({
    issued: false,
    refusal: 'limit_reached',
    retryAt: NOW + 5000,
  });
  await limited.tokens.refill();
  expect(limited.state.stock?.retryAt).toBe(NOW + 5000);
  await expect(limited.tokens.refill()).resolves.toBe('waiting');
  limited.advance(5000);
  await expect(limited.tokens.refill()).resolves.toBe('refilled');

  // sem Retry-After, a próxima meia-noite UTC
  const midnight = setup();
  midnight.refusals.push({ issued: false, refusal: 'limit_reached' });
  await midnight.tokens.refill();
  expect(midnight.state.stock?.retryAt).toBe(Date.UTC(2026, 10, 3));
});

it('backs off by the kind of attestation failure', async () => {
  const transient = setup({ attestation: { failure: 'transient' } });
  await expect(transient.tokens.refill()).resolves.toBe('failed');
  expect(transient.state.stock?.retryAt).toBe(NOW + RETRY_TRANSIENT_MS);
  expect(transient.issuer.issue).not.toHaveBeenCalled();

  const unavailable = setup({ attestation: { failure: 'unavailable' } });
  await unavailable.tokens.refill();
  expect(unavailable.state.stock?.retryAt).toBe(NOW + RETRY_REFUSED_MS);
});

it('keeps nothing from a batch with a signature that does not verify', async () => {
  const { tokens, issuer, state } = setup();
  const impostor = testIssuer();
  issuer.issue.mockImplementationOnce(async request => ({
    issued: true,
    tokenKey: issuerKey.tokenKey,
    tokenResponses: request.tokenRequests.map((item, index) => {
      const signature = issuerKey.sign(item);
      if (index === 5) signature[255] = (signature[255] + 1) % 256;
      return signature;
    }),
  }));
  await expect(tokens.refill()).resolves.toBe('failed');
  expect(state.stock).toEqual({
    tokens: [],
    retryAt: NOW + RETRY_TRANSIENT_MS,
  });

  // nem de um lote com outra chave ou faltando respostas
  issuer.issue.mockImplementationOnce(async request => ({
    issued: true,
    tokenKey: impostor.tokenKey,
    tokenResponses: request.tokenRequests.map(issuerKey.sign),
  }));
  issuer.issue.mockImplementationOnce(async request => ({
    issued: true,
    tokenKey: issuerKey.tokenKey,
    tokenResponses: request.tokenRequests.slice(1).map(issuerKey.sign),
  }));
  for (let i = 0; i < 2; i++) {
    await tokens.clear();
    await expect(tokens.refill()).resolves.toBe('failed');
    expect(state.stock).toEqual({
      tokens: [],
      retryAt: NOW + RETRY_TRANSIENT_MS,
    });
  }
});

it('answers failed, without throwing, when the network or the server fails', async () => {
  const { tokens, issuer, state } = setup();
  issuer.challenge.mockRejectedValueOnce(new Error('offline'));
  await expect(tokens.refill()).resolves.toBe('failed');
  // sem rede, tenta de novo na próxima oportunidade
  expect(state.stock).toBeNull();
  issuer.challenge.mockResolvedValueOnce(null);
  await expect(tokens.refill()).resolves.toBe('failed');
  expect(state.stock?.retryAt).toBe(NOW + RETRY_TRANSIENT_MS);
});

it('runs one refill at a time and lets takes wait their turn', async () => {
  const { tokens, issuer } = setup();
  const first = tokens.refill();
  const second = tokens.refill();
  expect(second).toBe(first);
  const taken = tokens.take();
  await expect(first).resolves.toBe('refilled');
  expect(issuer.challenge).toHaveBeenCalledTimes(1);
  // o take entrou na fila antes do lote chegar
  await expect(taken).resolves.toBeNull();
  await expect(tokens.count()).resolves.toBe(32);
});
