import { AxiosError, type AxiosResponse } from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { PrivateApiHttpClient } from '../index';
import { createTokenIssuer } from '../tokens';

const NOW = Date.UTC(2026, 10, 2, 15);

function http() {
  const client: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return { client, issuer: createTokenIssuer(client, () => NOW) };
}

function answered(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  return new AxiosError(
    'request failed',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status,
      statusText: '',
      data,
      headers,
      config: {},
    } as AxiosResponse,
  );
}

const offline = () => new AxiosError('Network Error', 'ERR_NETWORK');

const request = {
  // fb ff bf: `+/+/` na base64 comum, `-_-_` na de URL
  challenge: Uint8Array.from(
    { length: 36 },
    (_, i) => [0xfb, 0xff, 0xbf][i % 3],
  ),
  installation: new Uint8Array(32).fill(0xff),
  integrityToken: 'integrity',
  tokenRequests: [new Uint8Array(259).fill(1), new Uint8Array(259).fill(2)],
};

describe('the challenge', () => {
  it('reads the challenge and the key, in base64url with or without padding', async () => {
    const { client, issuer } = http();
    client.get.mockResolvedValueOnce({
      data: {
        challenge: '-_-_',
        tokenKey: 'AQID',
        expiresAt: '2026-11-02T15:05:00Z',
      },
    });
    await expect(issuer.challenge()).resolves.toEqual({
      challenge: Uint8Array.of(0xfb, 0xff, 0xbf),
      tokenKey: Uint8Array.of(1, 2, 3),
    });
    expect(client.get).toHaveBeenCalledWith('/v2/tokens/challenge');
  });

  it('is null with issuance off and an error without network or with an odd body', async () => {
    const { client, issuer } = http();
    client.get.mockRejectedValueOnce(
      answered(503, { error: 'token_issuance_unavailable' }),
    );
    await expect(issuer.challenge()).resolves.toBeNull();
    client.get.mockRejectedValueOnce(offline());
    await expect(issuer.challenge()).rejects.toEqual(new AppError('NETWORK'));
    client.get.mockResolvedValueOnce({ data: { challenge: 'não é base64' } });
    await expect(issuer.challenge()).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
  });
});

describe('the batch', () => {
  it('sends the bytes as padded base64url and reads the blind signatures', async () => {
    const { client, issuer } = http();
    client.post.mockResolvedValueOnce({
      data: { tokenKey: 'AQID', tokenResponses: ['BAU=', 'Bgc='] },
    });
    await expect(issuer.issue(request)).resolves.toEqual({
      issued: true,
      tokenKey: Uint8Array.of(1, 2, 3),
      tokenResponses: [Uint8Array.of(4, 5), Uint8Array.of(6, 7)],
    });
    const [path, body] = client.post.mock.calls[0];
    expect(path).toBe('/v2/tokens');
    expect(body).toEqual({
      challenge: '-_'.repeat(24),
      installation: `${'_'.repeat(42)}8=`,
      integrityToken: 'integrity',
      tokenRequests: [`${'AQEB'.repeat(86)}AQ==`, `${'AgIC'.repeat(86)}Ag==`],
    });
  });

  it('turns the documented refusals into reasons, with the time to come back', async () => {
    const { client, issuer } = http();
    const cases: [AxiosError, unknown][] = [
      [
        answered(403, { error: 'invalid_challenge' }),
        { issued: false, refusal: 'invalid_challenge' },
      ],
      [
        answered(403, { error: 'attestation_failed' }),
        { issued: false, refusal: 'attestation_failed' },
      ],
      [
        answered(422, { error: 'invalid_token_request' }),
        { issued: false, refusal: 'invalid_token_request' },
      ],
      [
        answered(
          429,
          { error: 'issuance_limit_reached' },
          { 'retry-after': 'Tue, 03 Nov 2026 00:00:00 GMT' },
        ),
        {
          issued: false,
          refusal: 'limit_reached',
          retryAt: Date.UTC(2026, 10, 3),
        },
      ],
      // o limite por minuto manda segundos
      [
        answered(429, { error: 'rate_limited' }, { 'retry-after': '30' }),
        { issued: false, refusal: 'limit_reached', retryAt: NOW + 30_000 },
      ],
      [
        answered(429, { error: 'rate_limited' }),
        { issued: false, refusal: 'limit_reached' },
      ],
      [
        answered(503, { error: 'attestation_unavailable' }),
        { issued: false, refusal: 'unavailable' },
      ],
      [
        answered(400, { error: 'invalid_request' }),
        { issued: false, refusal: 'unavailable' },
      ],
    ];
    for (const [error, expected] of cases) {
      client.post.mockRejectedValueOnce(error);
      await expect(issuer.issue(request)).resolves.toEqual(expected);
    }
  });

  it('fails without network, on other statuses and on an odd body', async () => {
    const { client, issuer } = http();
    client.post.mockRejectedValueOnce(offline());
    await expect(issuer.issue(request)).rejects.toEqual(
      new AppError('NETWORK'),
    );
    client.post.mockRejectedValueOnce(answered(500, {}));
    await expect(issuer.issue(request)).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
    client.post.mockRejectedValueOnce(answered(403, { error: 'outro' }));
    await expect(issuer.issue(request)).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
    client.post.mockResolvedValueOnce({ data: { tokenKey: 'AQID' } });
    await expect(issuer.issue(request)).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
  });
});
