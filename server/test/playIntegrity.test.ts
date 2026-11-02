import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';

import {
  createPlayIntegrityAttester,
  judgeVerdict,
} from '../src/adapters/outbound/attestation/playIntegrity.ts';
import { UnavailableError } from '../src/shared/errors.ts';

/*
 * A Play Integrity: o veredito conferido como a documentação recomenda e a
 * conversa com o Google (o OAuth da conta de serviço e o decodeIntegrityToken),
 * com um Google de mentira.
 */

const PACKAGE = 'com.aouerjmobile';
const CERTIFICATE = createHash('sha256').update('o certificado').digest();
const HASH = 'a'.repeat(64);
const NOW = Date.UTC(2026, 10, 1, 12);

/** Um veredito bom, com o que o teste trocar. */
function verdict({
  request = {},
  app = {},
  device = ['MEETS_DEVICE_INTEGRITY'],
}: {
  request?: Record<string, unknown>;
  app?: Record<string, unknown>;
  /** `null`: o Google omite o campo quando o aparelho não tem rótulo. */
  device?: string[] | null;
} = {}) {
  return {
    requestDetails: {
      requestPackageName: PACKAGE,
      requestHash: HASH,
      timestampMillis: String(NOW - 30_000),
      ...request,
    },
    appIntegrity: {
      appRecognitionVerdict: 'PLAY_RECOGNIZED',
      packageName: PACKAGE,
      certificateSha256Digest: [CERTIFICATE.toString('base64url')],
      versionCode: '20100',
      ...app,
    },
    deviceIntegrity: device ? { deviceRecognitionVerdict: device } : {},
    accountDetails: { appLicensingVerdict: 'LICENSED' },
  };
}

const EXPECTED = {
  packageName: PACKAGE,
  certificateDigests: [CERTIFICATE],
  requestHash: HASH,
  now: NOW,
  maxAgeMs: 6 * 60 * 1000,
};

test('a verdict is trusted only for this app, this request, a Play binary signed by us and an intact device', () => {
  assert.deepEqual(judgeVerdict(verdict(), EXPECTED), { trusted: true });
  // o digest pode vir com o `=` do fim
  assert.deepEqual(
    judgeVerdict(
      verdict({
        app: {
          certificateSha256Digest: [
            'outro',
            `${CERTIFICATE.toString('base64url')}=`,
          ],
        },
      }),
      EXPECTED,
    ),
    { trusted: true },
  );

  const cases: [string, unknown][] = [
    ['unreadable_verdict', { requestDetails: {} }],
    [
      'request_package',
      verdict({ request: { requestPackageName: 'com.outro' } }),
    ],
    ['request_hash', verdict({ request: { requestHash: 'b'.repeat(64) } })],
    [
      'stale_token',
      verdict({ request: { timestampMillis: String(NOW - 7 * 60 * 1000) } }),
    ],
    [
      'stale_token',
      verdict({ request: { timestampMillis: String(NOW + 5 * 60 * 1000) } }),
    ],
    [
      'app_not_recognized',
      verdict({ app: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' } }),
    ],
    // um token repetido volta com os vereditos limpos
    [
      'app_not_recognized',
      verdict({ app: { appRecognitionVerdict: 'UNEVALUATED' }, device: [] }),
    ],
    ['app_package', verdict({ app: { packageName: 'com.outro' } })],
    [
      'app_certificate',
      verdict({
        app: {
          certificateSha256Digest: [Buffer.alloc(32).toString('base64url')],
        },
      }),
    ],
    ['device_integrity', verdict({ device: ['MEETS_BASIC_INTEGRITY'] })],
    ['device_integrity', verdict({ device: null })],
  ];
  for (const [reason, payload] of cases)
    assert.deepEqual(
      judgeVerdict(payload, EXPECTED),
      { trusted: false, reason },
      reason,
    );
});

/** Um Google de mentira: o OAuth e o decodeIntegrityToken. */
function fakeGoogle({
  decode = () => ({ status: 200, body: { tokenPayloadExternal: verdict() } }),
}: {
  decode?: (token: string) => { status: number; body: unknown };
} = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  let tokens = 0;
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    if (url === 'https://oauth2.googleapis.com/token') {
      tokens += 1;
      return Response.json({
        access_token: `acesso-${tokens}`,
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }
    const { integrity_token: token } = JSON.parse(init.body as string) as {
      integrity_token: string;
    };
    const { status, body } = decode(token);
    return Response.json(body, { status });
  };
  return { fetch, calls };
}

const account = generateKeyPairSync('rsa', { modulusLength: 2048 });

function attester(
  google: ReturnType<typeof fakeGoogle>,
  clock = { now: () => NOW },
) {
  return createPlayIntegrityAttester({
    account: {
      clientEmail: 'ao-uerj@projeto.iam.gserviceaccount.com',
      privateKey: account.privateKey,
    },
    packageName: PACKAGE,
    certificateDigests: [CERTIFICATE],
    maxAgeMs: EXPECTED.maxAgeMs,
    fetch: google.fetch,
    now: () => clock.now(),
  });
}

test('the service account signs in by JWT once, and the integrity token goes to Google for this package', async () => {
  const google = fakeGoogle();
  const play = attester(google);
  assert.deepEqual(await play.verify('token-1', HASH), { trusted: true });
  assert.deepEqual(await play.verify('token-2', HASH), { trusted: true });

  const [oauth, ...decodes] = google.calls;
  assert.equal(decodes.length, 2);
  // o JWT: assinado pela conta de serviço, para o escopo da Play Integrity
  const form = new URLSearchParams(oauth.init.body as URLSearchParams);
  assert.equal(
    form.get('grant_type'),
    'urn:ietf:params:oauth:grant-type:jwt-bearer',
  );
  const [header, claims, signature] = (form.get('assertion') ?? '').split('.');
  assert.ok(
    verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      account.publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  );
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url').toString()), {
    iss: 'ao-uerj@projeto.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    iat: NOW / 1000,
    exp: NOW / 1000 + 3600,
  });

  assert.equal(
    decodes[0].url,
    'https://playintegrity.googleapis.com/v1/com.aouerjmobile:decodeIntegrityToken',
  );
  const headers = new Headers(decodes[0].init.headers);
  assert.equal(headers.get('authorization'), 'Bearer acesso-1');
  assert.deepEqual(JSON.parse(decodes[1].init.body as string), {
    integrity_token: 'token-2',
  });
});

test('a token Google cannot decode is untrusted; Google failing or out of reach is unavailable', async () => {
  let status = 400;
  const play = attester(
    fakeGoogle({ decode: () => ({ status, body: { error: {} } }) }),
  );
  assert.deepEqual(await play.verify('lixo', HASH), {
    trusted: false,
    reason: 'undecodable_token',
  });

  // a resposta leva a mensagem genérica; o log, o motivo
  status = 503;
  await assert.rejects(
    play.verify('token', HASH),
    (err: unknown) =>
      err instanceof UnavailableError &&
      err.code === 'attestation_unavailable' &&
      err.message === 'App attestation is temporarily unavailable' &&
      /Play Integrity answered 503/.test((err.cause as Error).message),
  );

  const offline = attester(
    fakeGoogle({
      decode: () => {
        throw new TypeError('fetch failed');
      },
    }),
  );
  await assert.rejects(
    offline.verify('token', HASH),
    (err: unknown) =>
      err instanceof UnavailableError &&
      err.code === 'attestation_unavailable' &&
      err.cause instanceof TypeError,
  );
});

test('after a 401 from Google the next verification asks for a new access token', async () => {
  let status = 401;
  const google = fakeGoogle({
    decode: () =>
      status === 200
        ? { status, body: { tokenPayloadExternal: verdict() } }
        : { status, body: {} },
  });
  const play = attester(google);
  await assert.rejects(play.verify('token', HASH), UnavailableError);
  status = 200;
  assert.deepEqual(await play.verify('token', HASH), { trusted: true });
  const oauth = google.calls.filter(
    call => call.url === 'https://oauth2.googleapis.com/token',
  );
  assert.equal(oauth.length, 2);
});

test('an access token is reused until a minute before it expires', async () => {
  const clock = { now: () => NOW };
  const google = fakeGoogle();
  const play = attester(google, clock);
  await play.verify('token', HASH);
  clock.now = () => NOW + 58 * 60 * 1000;
  await play.verify('token', HASH);
  clock.now = () => NOW + 59 * 60 * 1000 + 1;
  // (o veredito fica velho para este relógio; aqui só importa o OAuth)
  await play.verify('token', HASH);
  const oauth = google.calls.filter(
    call => call.url === 'https://oauth2.googleapis.com/token',
  );
  assert.equal(oauth.length, 2);
});
