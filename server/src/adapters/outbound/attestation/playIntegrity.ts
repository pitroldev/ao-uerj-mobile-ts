import { sign, type KeyObject } from 'node:crypto';

import { z } from 'zod';

import type {
  AppAttester,
  Attestation,
} from '../../../modules/access/ports.ts';
import { systemClock, type Clock } from '../../../shared/clock.ts';
import { UnavailableError } from '../../../shared/errors.ts';

/*
 * A Play Integrity (pedido standard): o app pede um token de integridade
 * sobre o `requestHash`, e o servidor o manda decifrar no Google, o único
 * que decifra os tokens standard. A conta de serviço entra pelo fluxo JWT do
 * OAuth 2.0, sem biblioteca do Google.
 */

const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const API_URL = 'https://playintegrity.googleapis.com/v1';

/** A conta de serviço com a Play Integrity API no projeto ligado ao app. */
export type ServiceAccount = { clientEmail: string; privateKey: KeyObject };

/** O que se espera do veredito. */
export type VerdictExpectation = {
  packageName: string;
  /** Os SHA-256 dos certificados de assinatura da Play. */
  certificateDigests: readonly Buffer[];
  requestHash: string;
  now: number;
  /** A idade máxima do token de integridade. */
  maxAgeMs: number;
};

/** Um relógio adiantado no aparelho não recusa o token por isso. */
const CLOCK_SKEW_MS = 60 * 1000;

const verdictSchema = z.object({
  requestDetails: z.object({
    requestPackageName: z.string(),
    requestHash: z.string().optional(),
    timestampMillis: z.coerce.number(),
  }),
  appIntegrity: z.object({
    appRecognitionVerdict: z.string(),
    packageName: z.string().optional(),
    certificateSha256Digest: z.array(z.string()).optional(),
  }),
  deviceIntegrity: z
    .object({ deviceRecognitionVerdict: z.array(z.string()).optional() })
    .optional(),
});

const untrusted = (reason: string): Attestation => ({
  trusted: false,
  reason,
});

/**
 * O veredito decifrado, conferido como a documentação recomenda: o pedido é
 * deste app e deste lote, recente, o binário é o da Play, assinado pelo
 * nosso certificado, e o aparelho é íntegro (`MEETS_DEVICE_INTEGRITY`). O
 * motivo da recusa vai para o log e não identifica ninguém.
 */
export function judgeVerdict(
  payload: unknown,
  expected: VerdictExpectation,
): Attestation {
  const parsed = verdictSchema.safeParse(payload);
  if (!parsed.success) return untrusted('unreadable_verdict');
  const { requestDetails, appIntegrity, deviceIntegrity } = parsed.data;
  if (requestDetails.requestPackageName !== expected.packageName)
    return untrusted('request_package');
  if (requestDetails.requestHash !== expected.requestHash)
    return untrusted('request_hash');
  const age = expected.now - requestDetails.timestampMillis;
  if (!(age <= expected.maxAgeMs && age >= -CLOCK_SKEW_MS))
    return untrusted('stale_token');
  if (appIntegrity.appRecognitionVerdict !== 'PLAY_RECOGNIZED')
    return untrusted('app_not_recognized');
  if (appIntegrity.packageName !== expected.packageName)
    return untrusted('app_package');
  const signedByUs = (appIntegrity.certificateSha256Digest ?? []).some(digest =>
    expected.certificateDigests.some(ours =>
      ours.equals(Buffer.from(digest, 'base64url')),
    ),
  );
  if (!signedByUs) return untrusted('app_certificate');
  if (
    !deviceIntegrity?.deviceRecognitionVerdict?.includes(
      'MEETS_DEVICE_INTEGRITY',
    )
  )
    return untrusted('device_integrity');
  return { trusted: true };
}

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url');

/** O JWT da conta de serviço que o OAuth troca por um token de acesso. */
function assertion(account: ServiceAccount, nowSeconds: number) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: SCOPE,
      aud: OAUTH_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = sign(
    'sha256',
    Buffer.from(`${header}.${claims}`),
    account.privateKey,
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

const unavailable = (detail: string, cause?: unknown) =>
  new UnavailableError(
    'attestation_unavailable',
    'App attestation is temporarily unavailable',
    { cause: cause ?? new Error(detail) },
  );

export function createPlayIntegrityAttester({
  account,
  packageName,
  certificateDigests,
  maxAgeMs,
  fetch = globalThis.fetch,
  now = systemClock,
  timeoutMs = 10_000,
}: {
  account: ServiceAccount;
  packageName: string;
  certificateDigests: readonly Buffer[];
  maxAgeMs: number;
  fetch?: typeof globalThis.fetch;
  now?: Clock;
  timeoutMs?: number;
}): AppAttester {
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function requestAccessToken(): Promise<string> {
    const response = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion(account, Math.floor(now() / 1000)),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok)
      throw unavailable(`Google OAuth answered ${response.status}`);
    const json = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof json.access_token !== 'string')
      throw unavailable('Google OAuth answered without an access token');
    const lifetime =
      Number(json.expires_in) > 0 ? Number(json.expires_in) : 3600;
    cached = { token: json.access_token, expiresAt: now() + lifetime * 1000 };
    return json.access_token;
  }

  /** O token de acesso, reaproveitado até um minuto antes de vencer. */
  function accessToken(): Promise<string> {
    if (cached && cached.expiresAt - 60_000 > now())
      return Promise.resolve(cached.token);
    pending ??= requestAccessToken().finally(() => {
      pending = null;
    });
    return pending;
  }

  async function decode(integrityToken: string, requestHash: string) {
    const token = await accessToken();
    const response = await fetch(
      `${API_URL}/${encodeURIComponent(packageName)}:decodeIntegrityToken`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ integrity_token: integrityToken }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    // um token que o Google não decifra é do cliente; o resto é nosso
    if (response.status === 400) {
      await response.body?.cancel();
      return untrusted('undecodable_token');
    }
    if (response.status === 401) cached = null;
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable(`Play Integrity answered ${response.status}`);
    }
    const json = (await response.json()) as { tokenPayloadExternal?: unknown };
    return judgeVerdict(json.tokenPayloadExternal, {
      packageName,
      certificateDigests,
      requestHash,
      now: now(),
      maxAgeMs,
    });
  }

  return {
    async verify(integrityToken, requestHash) {
      try {
        return await decode(integrityToken, requestHash);
      } catch (err) {
        if (err instanceof UnavailableError) throw err;
        // a rede, o tempo esgotado, uma resposta que não é JSON
        throw unavailable('Play Integrity could not be reached', err);
      }
    },
  };
}
