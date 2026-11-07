import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';
import http from 'node:http';

import {
  assetHashOf,
  NO_UPDATE_AVAILABLE_DIRECTIVE,
  OTA_ASSET_PATH,
} from '../src/modules/ota/domain.ts';

/*
 * O lado do CI nos testes: uma chave descartável, gerada a cada execução
 * (nada de chave privada no Git), com um certificado autoassinado montado
 * aqui mesmo em DER, os textos assinados e os manifestos.
 */

/** Um elemento DER (X.690): a tag, o tamanho na forma mais curta e o conteúdo. */
function tlv(tag: number, ...content: Buffer[]): Buffer {
  const body = Buffer.concat(content);
  const size: number[] = [];
  for (let rest = body.length; rest > 0; rest = Math.floor(rest / 256))
    size.unshift(rest % 256);
  const length =
    body.length < 128 ? [body.length] : [128 + size.length, ...size];
  return Buffer.concat([Buffer.from([tag, ...length]), body]);
}

const DER = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  UTC_TIME: 0x17,
  SEQUENCE: 0x30,
  SET: 0x31,
};

/** sha256WithRSAEncryption (1.2.840.113549.1.1.11), sem parâmetros. */
const SHA256_WITH_RSA = tlv(
  DER.SEQUENCE,
  tlv(DER.OID, Buffer.from('2a864886f70d01010b', 'hex')),
  tlv(DER.NULL),
);

/** Um nome com só o CN (2.5.4.3). */
const nameOf = (commonName: string) =>
  tlv(
    DER.SEQUENCE,
    tlv(
      DER.SET,
      tlv(
        DER.SEQUENCE,
        tlv(DER.OID, Buffer.from('550403', 'hex')),
        tlv(DER.UTF8_STRING, Buffer.from(commonName, 'utf8')),
      ),
    ),
  );

/** UTCTime, AAMMDDhhmmssZ (vale até 2049). */
const utcTime = (date: Date) =>
  tlv(
    DER.UTC_TIME,
    Buffer.from(
      `${date.toISOString().replace(/[-:T]/g, '').slice(2, 14)}Z`,
      'ascii',
    ),
  );

export type OtaKeys = {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** O certificado autoassinado (X.509 v1) da chave, em PEM. */
  certificate: string;
};

/** Uma chave RSA de 2048 bits e um certificado autoassinado para ela. */
export function otaSigningKeys(commonName = 'AO UERJ (teste)'): OtaKeys {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const tbs = tlv(
    DER.SEQUENCE,
    tlv(DER.INTEGER, randomBytes(8).fill(1, 0, 1)),
    SHA256_WITH_RSA,
    nameOf(commonName),
    tlv(
      DER.SEQUENCE,
      utcTime(new Date(Date.UTC(2020, 0, 1))),
      utcTime(new Date(Date.UTC(2049, 0, 1))),
    ),
    nameOf(commonName),
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const der = tlv(
    DER.SEQUENCE,
    tbs,
    SHA256_WITH_RSA,
    tlv(DER.BIT_STRING, Buffer.from([0]), sign('sha256', tbs, privateKey)),
  );
  const lines = der.toString('base64').match(/.{1,64}/g) ?? [];
  return {
    privateKey,
    publicKey,
    certificate: `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`,
  };
}

/** RSA-SHA256 (PKCS #1 v1.5) dos bytes UTF-8 do texto, em base64, como o CI assina. */
export const signText = (privateKey: KeyObject, text: string) =>
  sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64');

/** A assinatura pronta do "nada novo" para esta chave. */
export const noUpdateSignatureOf = (keys: OtaKeys) =>
  signText(keys.privateKey, NO_UPDATE_AVAILABLE_DIRECTIVE);

export const ORIGIN = 'https://pitrol.dev';

/** Um arquivo do update como o CI o descreve no manifesto. */
export type ManifestAsset = {
  hash: string;
  key: string;
  contentType: string;
  fileExtension?: string;
  url: string;
};

export function assetOf(
  bytes: Buffer,
  {
    fileExtension = '.png',
    contentType = 'image/png',
    origin = ORIGIN,
  }: { fileExtension?: string; contentType?: string; origin?: string } = {},
): ManifestAsset {
  const hash = assetHashOf(bytes);
  return {
    hash,
    key: createHash('md5').update(bytes).digest('hex'),
    contentType,
    fileExtension,
    url: `${origin}${OTA_ASSET_PATH}${hash}`,
  };
}

/** Um bundle de mentira: comprime bem, como um de verdade. */
export const bundleBytes = (label: string, repeat = 400) =>
  Buffer.from(
    `// ${label}\n${'console.log("AO UERJ");\n'.repeat(repeat)}`,
    'utf8',
  );

/** O manifesto como o CI o monta (o texto que vai assinado). */
export function manifestText({
  id = randomUUID(),
  createdAt,
  runtimeVersion,
  launchAsset,
  assets = [],
  extra = {},
}: {
  id?: string;
  createdAt: Date | string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets?: ManifestAsset[];
  extra?: Record<string, unknown>;
}): string {
  return JSON.stringify({
    id,
    createdAt:
      typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    extra,
  });
}

export const rollbackText = (commitTime: Date) =>
  JSON.stringify({
    type: 'rollBackToEmbedded',
    parameters: { commitTime: commitTime.toISOString() },
  });

export type RawAnswer = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

/**
 * Uma requisição sem nada a mais (o fetch do Node põe `accept-encoding` e
 * descomprime sozinho): os testes veem os bytes como o app recebe.
 */
export function rawRequest(
  url: string,
  {
    method = 'GET',
    headers = {},
    body,
  }: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  } = {},
): Promise<RawAnswer> {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, response => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(body);
  });
}

export type MultipartPart = { headers: Record<string, string>; body: string };

/**
 * Lê um `multipart/mixed` como o expo-updates: o delimitador do
 * `content-type`, CRLF, os cabeçalhos de cada parte como vieram (a caixa
 * também) e o corpo exato.
 */
export function readMultipart(
  contentType: string | undefined,
  payload: Buffer,
): MultipartPart[] {
  const boundary = /^multipart\/mixed; boundary=([A-Za-z0-9-]+)$/.exec(
    contentType ?? '',
  )?.[1];
  if (!boundary) throw new Error(`not multipart/mixed: ${contentType}`);
  const text = payload.toString('utf8');
  const open = `--${boundary}\r\n`;
  const close = `\r\n--${boundary}--\r\n`;
  if (!text.startsWith(open) || !text.endsWith(close))
    throw new Error('the body does not open and close with the boundary');
  return text
    .slice(open.length, text.length - close.length)
    .split(`\r\n--${boundary}\r\n`)
    .map(chunk => {
      const end = chunk.indexOf('\r\n\r\n');
      const headers = Object.fromEntries(
        chunk
          .slice(0, end)
          .split('\r\n')
          .map(line => {
            const at = line.indexOf(': ');
            return [line.slice(0, at), line.slice(at + 2)];
          }),
      );
      return { headers, body: chunk.slice(end + 4) };
    });
}

/** O `sig` de um `expo-signature` exatamente como o contrato manda. */
export function signatureOf(header: string | undefined): string {
  const match = /^sig="([A-Za-z0-9+/]+={0,2})", keyid="main"$/.exec(
    header ?? '',
  );
  if (!match) throw new Error(`unexpected expo-signature: ${header}`);
  return match[1];
}
