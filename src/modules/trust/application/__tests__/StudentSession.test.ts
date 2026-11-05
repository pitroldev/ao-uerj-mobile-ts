import { AppError } from '@root/shared/errors/AppError';
import { testCrypto } from '../../__tests__/testCrypto';
import { sessionRequestHash } from '../../domain/studentSession';
import { fromBase64 } from '../../domain/bytes';
import type {
  Attestation,
  SessionCreation,
  SessionRequest,
  StoredSession,
  StudentSessionApiPort,
  StudentSessionStorePort,
} from '../ports';
import { RETRY_AFTER_MS, StudentSession } from '../StudentSession';

const CHALLENGE = Uint8Array.from({ length: 36 }, (_, index) => index);
const MINUTE = 60_000;

type Account = { scope: string; matricula: string; name: string };

function setup({
  account = {
    scope: 'account-a',
    matricula: ' 201810012345 ',
    name: 'MARINA  COSTA',
  },
  device = 'play',
}: {
  account?: Account | null;
  /** Quem atesta: a Play Integrity (Android) ou o App Attest (iPhone). */
  device?: 'play' | 'appAttest';
} = {}) {
  let current = account;
  let saved: StoredSession | null = null;
  let installation: string | null = null;
  let time = Date.UTC(2026, 10, 3, 12);
  const store: jest.Mocked<StudentSessionStorePort> = {
    read: jest.fn(async () => saved),
    write: jest.fn(async next => {
      saved = next;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
    readInstallation: jest.fn(async () => installation),
    writeInstallation: jest.fn(async next => {
      installation = next;
    }),
  };
  let sequence = 0;
  const api: jest.Mocked<StudentSessionApiPort> = {
    challenge: jest.fn(async () => CHALLENGE),
    create: jest.fn<Promise<SessionCreation>, [SessionRequest]>(async () => ({
      created: true,
      token: `token-${++sequence}`,
      expiresAt: Date.UTC(2026, 11, 1),
    })),
    end: jest.fn<Promise<void>, [string]>(async () => undefined),
  };
  const attest = jest.fn<Promise<Attestation>, [string]>(async hash =>
    device === 'play'
      ? { token: `play:${hash}` }
      : { appAttest: { keyId: `key:${hash}`, attestation: 'cbor' } },
  );
  const session = new StudentSession({
    api,
    device: { crypto: testCrypto, attest },
    store,
    account: () => current,
    now: () => time,
  });
  return {
    session,
    api,
    store,
    attest,
    signOut: () => {
      current = null;
    },
    switchTo: (next: Account | null) => {
      current = next;
    },
    installation: () => installation,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

/** Espera o pedido de entrada chegar ao servidor falso. */
async function untilCreated(api: jest.Mocked<StudentSessionApiPort>, n = 1) {
  while (api.create.mock.calls.length < n)
    await new Promise(resolve => setTimeout(() => resolve(null), 0));
}

it('signs in once with the attested matrícula and name, and reuses the session', async () => {
  const { session, api, attest, installation } = setup();
  const [first, second] = await Promise.all([session.token(), session.token()]);
  expect(first).toBe('token-1');
  expect(second).toBe('token-1');
  expect(api.create).toHaveBeenCalledTimes(1);

  // a matrícula e o nome vão limpos, e a atestação cobre exatamente eles
  const request = api.create.mock.calls[0][0];
  expect(request).toMatchObject({
    matricula: '201810012345',
    name: 'MARINA COSTA',
  });
  expect(request.proof).toEqual({ token: `play:${attest.mock.calls[0][0]}` });
  expect(attest).toHaveBeenCalledWith(
    sessionRequestHash(testCrypto, {
      challenge: CHALLENGE,
      installation: request.installation,
      matricula: '201810012345',
      name: 'MARINA COSTA',
    }),
  );
  // o id da instalação fica guardado e é o mesmo depois
  expect(fromBase64(installation()!)).toEqual(request.installation);
  await expect(session.token()).resolves.toBe('token-1');
  expect(api.create).toHaveBeenCalledTimes(1);
});

it('signs in on the iPhone with App Attest over the same request hash', async () => {
  const { session, api, attest } = setup({ device: 'appAttest' });
  await expect(session.token()).resolves.toBe('token-1');
  const request = api.create.mock.calls[0][0];
  const hash = attest.mock.calls[0][0];
  expect(hash).toBe(
    sessionRequestHash(testCrypto, {
      challenge: CHALLENGE,
      installation: request.installation,
      matricula: '201810012345',
      name: 'MARINA COSTA',
    }),
  );
  // a chave nova e a atestação vão no lugar do token da Play
  expect(request.proof).toEqual({
    appAttest: { keyId: `key:${hash}`, attestation: 'cbor' },
  });
  expect(request).toMatchObject({
    matricula: '201810012345',
    name: 'MARINA COSTA',
  });
  await expect(session.token()).resolves.toBe('token-1');
  expect(attest).toHaveBeenCalledTimes(1);
});

it.each([
  ['Apple busy', { failure: 'transient' } as const, RETRY_AFTER_MS.transient],
  [
    'no App Attest on the device',
    { failure: 'unavailable' } as const,
    RETRY_AFTER_MS.refused,
  ],
])(
  'with App Attest, after %s, waits as long as on Android',
  async (_, failure, wait) => {
    const ctx = setup({ device: 'appAttest' });
    ctx.attest.mockResolvedValueOnce(failure);
    const first = await ctx.session.token().catch((caught: unknown) => caught);
    expect(first).toEqual(new AppError('STUDENT_PROOF_UNAVAILABLE'));
    expect(ctx.api.create).not.toHaveBeenCalled();
    ctx.advance(wait - 1);
    await expect(ctx.session.token()).rejects.toBe(first);
    expect(ctx.attest).toHaveBeenCalledTimes(1);
    ctx.advance(1);
    await expect(ctx.session.token()).resolves.toBe('token-1');
  },
);

it('with App Attest refused on the server, waits an hour before a new key', async () => {
  const ctx = setup({ device: 'appAttest' });
  ctx.api.create.mockResolvedValueOnce({
    created: false,
    refusal: 'attestation_failed',
  });
  const first = await ctx.session.token().catch((caught: unknown) => caught);
  expect(first).toEqual(new AppError('STUDENT_PROOF_UNAVAILABLE'));
  ctx.advance(RETRY_AFTER_MS.refused - 1);
  await expect(ctx.session.token()).rejects.toBe(first);
  expect(ctx.attest).toHaveBeenCalledTimes(1);
  ctx.advance(1);
  await expect(ctx.session.token()).resolves.toBe('token-1');
  expect(ctx.attest).toHaveBeenCalledTimes(2);
});

it('signs in again after the server refused the session, and for another account', async () => {
  const { session, api, switchTo } = setup();
  await session.token();
  await session.invalidate('token-1');
  await expect(session.token()).resolves.toBe('token-2');
  // a recusa de uma sessão velha não apaga a atual
  await session.invalidate('token-1');
  await expect(session.token()).resolves.toBe('token-2');

  switchTo({ scope: 'account-b', matricula: '201910054321', name: 'LUCAS' });
  await expect(session.token()).resolves.toBe('token-3');
  expect(api.create).toHaveBeenCalledTimes(3);
});

it('tries a second challenge when the first one expired', async () => {
  const { session, api } = setup();
  api.create
    .mockResolvedValueOnce({ created: false, refusal: 'invalid_challenge' })
    .mockResolvedValueOnce({
      created: true,
      token: 'token-x',
      expiresAt: 1,
    });
  await expect(session.token()).resolves.toBe('token-x');
  expect(api.challenge).toHaveBeenCalledTimes(2);
});

it.each([
  [
    'the attestation refused on the server',
    (ctx: ReturnType<typeof setup>) =>
      ctx.api.create.mockResolvedValueOnce({
        created: false,
        refusal: 'attestation_failed',
      }),
    RETRY_AFTER_MS.refused,
  ],
  [
    'no Play Integrity on the device',
    (ctx: ReturnType<typeof setup>) =>
      ctx.attest.mockResolvedValueOnce({ failure: 'unavailable' }),
    RETRY_AFTER_MS.refused,
  ],
  [
    'the Play busy',
    (ctx: ReturnType<typeof setup>) =>
      ctx.attest.mockResolvedValueOnce({ failure: 'transient' }),
    RETRY_AFTER_MS.transient,
  ],
  [
    'the identification off on the server',
    (ctx: ReturnType<typeof setup>) =>
      ctx.api.challenge.mockResolvedValueOnce(null),
    RETRY_AFTER_MS.server,
  ],
  [
    'the server limit',
    (ctx: ReturnType<typeof setup>) =>
      ctx.api.create.mockRejectedValueOnce(new AppError('RATE_LIMITED')),
    RETRY_AFTER_MS.transient,
  ],
])(
  'after %s, waits before spending another attestation',
  async (_, refuse, wait) => {
    const ctx = setup();
    refuse(ctx);
    const first = await ctx.session.token().catch((caught: unknown) => caught);
    expect(first).toBeInstanceOf(AppError);
    const challenges = ctx.api.challenge.mock.calls.length;
    // as telas perguntam de novo: o mesmo erro, sem ir à Play nem ao servidor
    ctx.advance(wait - 1);
    await expect(ctx.session.token()).rejects.toBe(first);
    expect(ctx.api.challenge).toHaveBeenCalledTimes(challenges);
    ctx.advance(1);
    await expect(ctx.session.token()).resolves.toBe('token-1');
  },
);

it('without network, tries again on the next request (nothing was spent)', async () => {
  const { session, api } = setup();
  api.challenge.mockRejectedValueOnce(new AppError('NETWORK'));
  await expect(session.token()).rejects.toEqual(new AppError('NETWORK'));
  await expect(session.token()).resolves.toBe('token-1');
});

it('says when the ban ends, and checks again at most an hour later', async () => {
  const { session, api, advance } = setup();
  const until = Date.UTC(2026, 10, 3, 12) + 3 * 60 * MINUTE;
  api.create.mockResolvedValueOnce({
    created: false,
    refusal: 'banned',
    ban: { until, reason: 'Assédio' },
  });
  const error = await session.token().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe('STUDENT_BANNED');
  expect((error as AppError).message).toMatch(
    /até \d\d\/11.*Motivo: Assédio\./,
  );
  advance(59 * MINUTE);
  await expect(session.token()).rejects.toBe(error);
  expect(api.create).toHaveBeenCalledTimes(1);
  // a moderação pode ter desbanido: depois de uma hora, tenta de novo
  advance(MINUTE);
  await expect(session.token()).resolves.toBe('token-1');
});

it('does not sign in signed out, on devices without attestation or vault', async () => {
  await expect(setup({ account: null }).session.token()).rejects.toEqual(
    new AppError('NOT_LOGGED_IN'),
  );
  const bare = new StudentSession({
    api: setup().api,
    device: null,
    store: null,
    account: () => null,
  });
  expect(bare.supported).toBe(false);
  await expect(bare.token()).rejects.toEqual(
    new AppError('STUDENT_PROOF_UNAVAILABLE'),
  );
});

it('keeps the session for the logout cleanup, then ends it on the server', async () => {
  const { session, api, store, signOut } = setup();
  await session.token();
  signOut();
  const leaving = await session.current();
  expect(leaving).toBe('token-1');
  // a saída das mesas e dos grupos ainda usa a sessão da conta que saiu
  await expect(session.token()).resolves.toBe('token-1');
  await session.clear(leaving);
  expect(store.clear).toHaveBeenCalled();
  expect(api.end).toHaveBeenCalledWith('token-1');
  await expect(session.token()).rejects.toEqual(new AppError('NOT_LOGGED_IN'));
});

it('a logout that finishes late does not end the next account session', async () => {
  const { session, api, store, signOut, switchTo } = setup();
  await session.token();
  signOut();
  const leaving = await session.current();
  // outra conta entra antes de a saída terminar
  switchTo({ scope: 'account-b', matricula: '201910054321', name: 'LUCAS' });
  await expect(session.token()).resolves.toBe('token-2');
  await session.clear(leaving);
  expect(api.end).toHaveBeenCalledWith('token-1');
  expect(api.end).not.toHaveBeenCalledWith('token-2');
  expect(store.clear).not.toHaveBeenCalled();
  await expect(session.token()).resolves.toBe('token-2');
});

it('drops a session that finished after the account left, and ends it on the server', async () => {
  const { session, api, store, signOut } = setup();
  let finish: (value: SessionCreation) => void = () => undefined;
  api.create.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const entering = session.token();
  await untilCreated(api);
  signOut();
  finish({ created: true, token: 'late', expiresAt: 1 });
  await expect(entering).rejects.toEqual(new AppError('SESSION_CHANGED'));
  expect(store.write).not.toHaveBeenCalled();
  expect(api.end).toHaveBeenCalledWith('late');
});

it('a new account does not wait for the sign-in of the one that left', async () => {
  const { session, api, switchTo } = setup();
  let finish: (value: SessionCreation) => void = () => undefined;
  api.create.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const first = session.token();
  await untilCreated(api);
  switchTo({ scope: 'account-b', matricula: '201910054321', name: 'LUCAS' });
  // a conta nova entra por conta própria, com a matrícula dela
  await expect(session.token()).resolves.toBe('token-1');
  expect(api.create.mock.calls[1][0].matricula).toBe('201910054321');
  finish({ created: true, token: 'late', expiresAt: 1 });
  await expect(first).rejects.toEqual(new AppError('SESSION_CHANGED'));
  await expect(session.token()).resolves.toBe('token-1');
});
