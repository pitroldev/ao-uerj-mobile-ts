import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import http2, {
  type ClientHttp2Session,
  type IncomingHttpHeaders,
  type IncomingHttpStatusHeader,
} from 'node:http2';

import type { PushDevice } from '../../../modules/companion/domain.ts';
import type {
  PushMessage,
  PushResult,
  PushSender,
} from '../../../modules/companion/ports.ts';

/** O servidor do APNs de cada ambiente. */
export const APNS_ORIGINS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

/**
 * O token do provedor vale uma hora na Apple, que recusa trocá-lo mais de uma
 * vez a cada 20 minutos: 40 minutos ficam no meio.
 */
export const APNS_TOKEN_TTL_MS = 40 * 60 * 1000;
/** Um envio que não responde nisso vira `failed` (a próxima rodada tenta). */
export const APNS_TIMEOUT_MS = 10 * 1000;
/** A conexão parada fecha sozinha: os avisos são raros. */
const IDLE_MS = 5 * 60 * 1000;

/** Por que a Apple recusou: o status e o `reason` da resposta, sem o token. */
export class ApnsError extends Error {
  readonly status: number | null;
  readonly reason: string | null;

  constructor(status: number | null, reason: string | null, cause?: unknown) {
    super(
      status
        ? `APNs answered ${status}${reason ? ` ${reason}` : ''}`
        : `APNs request failed${reason ? `: ${reason}` : ''}`,
      cause === undefined ? undefined : { cause },
    );
    this.name = 'ApnsError';
    this.status = status;
    this.reason = reason;
  }
}

export type ApnsOptions = {
  /** O Key ID da chave .p8 (10 caracteres). */
  keyId: string;
  /** O Team ID da conta da Apple. */
  teamId: string;
  /** A chave .p8 (PEM, EC P-256). */
  privateKey: string | KeyObject;
  /** O bundle id do app (`apns-topic`). */
  topic: string;
  environment: keyof typeof APNS_ORIGINS;
  /** Outro servidor (os testes, com um HTTP/2 local). */
  origin?: string;
  timeoutMs?: number;
  now?: () => number;
  /** As recusas e as falhas, para o log (o token do aparelho não vai). */
  onError?: (err: ApnsError) => void;
};

/** Os tokens que nunca vão chegar: o pedido vai embora com eles. */
const GONE_REASONS = new Set(['BadDeviceToken', 'DeviceTokenNotForTopic']);
/** O token do provedor venceu ou foi recusado: o próximo envio faz outro. */
const PROVIDER_TOKEN_REASONS = new Set([
  'ExpiredProviderToken',
  'InvalidProviderToken',
]);

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** O corpo do aviso, como a Apple o quer. */
export function apnsPayload(message: PushMessage): string {
  return JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      'thread-id': message.thread,
    },
    target: message.target,
  });
}

/**
 * O push para o iPhone pelo APNs: HTTP/2 com o token do provedor (um JWT
 * ES256 assinado com a chave .p8), refeito a cada `APNS_TOKEN_TTL_MS`. Uma
 * conexão só, aberta no primeiro envio e reaberta quando cai; parada por
 * `IDLE_MS`, fecha. Nenhum erro sobe: `send` diz `sent`, `gone` (410 ou um
 * token que não serve) ou `failed`, e o motivo vai para `onError`.
 */
export function createApnsSender({
  keyId,
  teamId,
  privateKey,
  topic,
  environment,
  origin = APNS_ORIGINS[environment],
  timeoutMs = APNS_TIMEOUT_MS,
  now = Date.now,
  onError = () => undefined,
}: ApnsOptions): PushSender {
  const key =
    typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  let provider: { token: string; at: number } | null = null;
  let session: ClientHttp2Session | null = null;

  function providerToken() {
    const time = now();
    if (provider && time - provider.at < APNS_TOKEN_TTL_MS)
      return provider.token;
    const unsigned = `${base64url({ alg: 'ES256', kid: keyId })}.${base64url({
      iss: teamId,
      iat: Math.floor(time / 1000),
    })}`;
    const signature = sign('sha256', Buffer.from(unsigned), {
      key,
      dsaEncoding: 'ieee-p1363',
    });
    provider = {
      token: `${unsigned}.${signature.toString('base64url')}`,
      at: time,
    };
    return provider.token;
  }

  function connection(): ClientHttp2Session {
    if (session && !session.closed && !session.destroyed) return session;
    const opened = http2.connect(origin);
    const forget = () => {
      if (session === opened) session = null;
    };
    opened.on('error', forget);
    opened.on('goaway', forget);
    opened.on('close', forget);
    opened.setTimeout(IDLE_MS, () => opened.close());
    // a conexão não segura o processo no desligamento
    opened.unref();
    session = opened;
    return opened;
  }

  function request(device: PushDevice, message: PushMessage) {
    return new Promise<{ status: number; reason: string | null }>(
      (resolve, reject) => {
        const stream = connection().request({
          ':method': 'POST',
          ':path': `/3/device/${device.token}`,
          authorization: `bearer ${providerToken()}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': String(
            Math.max(0, Math.floor(message.expiresAt.getTime() / 1000)),
          ),
          'apns-collapse-id': message.collapseId,
          'content-type': 'application/json',
        });
        let status = 0;
        const chunks: Buffer[] = [];
        stream.setTimeout(timeoutMs, () => {
          stream.close(http2.constants.NGHTTP2_CANCEL);
          reject(new ApnsError(null, 'timeout'));
        });
        stream.on(
          'response',
          (headers: IncomingHttpHeaders & IncomingHttpStatusHeader) => {
            status = Number(headers[':status'] ?? 0);
          },
        );
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          let reason: string | null = null;
          const text = Buffer.concat(chunks).toString('utf8');
          if (text)
            try {
              const parsed = JSON.parse(text) as { reason?: unknown };
              if (typeof parsed.reason === 'string') reason = parsed.reason;
            } catch {
              reason = null;
            }
          resolve({ status, reason });
        });
        stream.on('error', err =>
          reject(new ApnsError(null, err.message, err)),
        );
        stream.end(apnsPayload(message));
      },
    );
  }

  return {
    async send(device, message): Promise<PushResult> {
      let answer: { status: number; reason: string | null };
      try {
        answer = await request(device, message);
      } catch (err) {
        // a conexão pode ter ficado ruim: a próxima abre outra
        session?.destroy();
        session = null;
        onError(
          err instanceof ApnsError
            ? err
            : new ApnsError(null, (err as Error).message, err),
        );
        return 'failed';
      }
      const { status, reason } = answer;
      if (status === 200) return 'sent';
      if (status === 410 || (status === 400 && GONE_REASONS.has(reason ?? '')))
        return 'gone';
      if (status === 403 && PROVIDER_TOKEN_REASONS.has(reason ?? ''))
        provider = null;
      onError(new ApnsError(status, reason));
      return 'failed';
    },

    async close() {
      const open = session;
      session = null;
      if (!open || open.closed || open.destroyed) return;
      await new Promise<void>(resolve => open.close(() => resolve()));
    },
  };
}
