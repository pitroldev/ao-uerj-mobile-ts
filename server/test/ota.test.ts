import assert from 'node:assert/strict';
import { randomBytes, randomUUID, verify, X509Certificate } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { pino, type Logger } from 'pino';

import { multipartMixed } from '../src/adapters/inbound/http/ota/multipart.ts';
import { createFileOtaAssetStore } from '../src/adapters/outbound/files/otaAssetStore.ts';
import {
  OTA_CODE_SIGNING_CERTIFICATE,
  OTA_NO_UPDATE_AVAILABLE_SIGNATURE,
  otaCodeSigningCertificate,
} from '../src/adapters/outbound/ota/certificate.ts';
import { createOtaSignatureVerifier } from '../src/adapters/outbound/ota/signature.ts';
import { createServer, type Server } from '../src/composition.ts';
import { loadConfig } from '../src/config.ts';
import { createOtaUpdates } from '../src/modules/ota/application.ts';
import {
  answerFor,
  assetHashOf,
  isAssetHash,
  isSignature,
  NO_UPDATE_AVAILABLE_DIRECTIVE,
  OTA_ASSET_GRACE_MS,
  OTA_LIMITS,
  readDirective,
  readManifest,
  timestampOf,
  type OtaEntry,
} from '../src/modules/ota/domain.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { DomainError } from '../src/shared/errors.ts';
import {
  assetOf,
  bundleBytes,
  manifestText,
  noUpdateSignatureOf,
  ORIGIN,
  otaSigningKeys,
  rawRequest,
  readMultipart,
  rollbackText,
  signatureOf,
  signText,
  type OtaKeys,
} from './ota.ts';
import {
  manualClock,
  memoryAttachments,
  memoryOtaEntries,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';

const keys = otaSigningKeys();
const strangerKeys = otaSigningKeys('outra chave');
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

const directories: string[] = [];
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
});

const temporaryDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ao-uerj-ota-'));
  directories.push(dir);
  return dir;
};

/** Um runtime novo por teste: o servidor é dividido, as publicações não. */
const runtime = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;

/** Datas que só andam para a frente, no passado recente (o servidor recusa o futuro). */
let tick = Date.now() - 6 * 60 * 60 * SECOND;
const nextDate = () => new Date((tick += SECOND));

const APP_HEADERS = {
  'expo-protocol-version': '1',
  'expo-platform': 'android',
  accept: 'multipart/mixed,application/expo+json,application/json',
  'expo-expect-signature': 'sig, keyid="main", alg="rsa-v1_5-sha256"',
};

async function serve({
  env = {},
  certificate = keys.certificate,
  noUpdateSignature = noUpdateSignatureOf(keys),
  logger = silentLogger,
}: {
  env?: Record<string, string>;
  certificate?: string | null;
  noUpdateSignature?: string | null;
  logger?: Logger;
} = {}) {
  const dir = temporaryDir();
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const server = createServer(testConfig({ OTA_DIR: dir, ...env }), logger, {
    database: db.database,
    repositories: memory.repositories,
    attachments: memoryAttachments().store,
    portal: createPortalWatch({ probe: async () => 302 }),
    ota: { certificate, noUpdateSignature },
  });
  opened.push(server);
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}`;

  const json = async (method: string, route: string, payload: unknown) => {
    const answer = await rawRequest(`${base}${route}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
    return { ...answer, json: JSON.parse(answer.body.toString('utf8')) };
  };

  const ask = (headers: Record<string, string | undefined> = {}) => {
    const merged = Object.fromEntries(
      Object.entries({ ...APP_HEADERS, ...headers }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    return rawRequest(`${base}/aouerj/ota/manifest`, { headers: merged });
  };

  const upload = (
    bytes: Buffer,
    {
      contentType = 'image/png',
      hash = assetHashOf(bytes),
      signature = signText(keys.privateKey, hash),
    }: {
      contentType?: string | null;
      hash?: string;
      signature?: string | null;
    } = {},
  ) =>
    rawRequest(`${base}/aouerj/ota/assets/${hash}`, {
      method: 'PUT',
      headers: {
        ...(contentType === null ? {} : { 'content-type': contentType }),
        ...(signature === null ? {} : { 'expo-ota-signature': signature }),
      },
      body: bytes,
    });

  const publish = ({
    platform = 'android',
    runtimeVersion,
    manifest,
    signature = signText(keys.privateKey, manifest),
  }: {
    platform?: string;
    runtimeVersion: string;
    manifest: string;
    signature?: string;
  }) =>
    json('POST', '/aouerj/ota/updates', {
      platform,
      runtimeVersion,
      manifest,
      signature,
    });

  const rollback = ({
    platform = 'android',
    runtimeVersion,
    directive,
    signature = signText(keys.privateKey, directive),
  }: {
    platform?: string;
    runtimeVersion: string;
    directive: string;
    signature?: string;
  }) =>
    json('POST', '/aouerj/ota/directives', {
      platform,
      runtimeVersion,
      directive,
      signature,
    });

  /** Envia os arquivos e publica o manifesto deles, como o CI. */
  async function release({
    runtimeVersion,
    platform = 'android',
    label = randomUUID(),
    createdAt = nextDate(),
    id = randomUUID(),
  }: {
    runtimeVersion: string;
    platform?: string;
    label?: string;
    createdAt?: Date;
    id?: string;
  }) {
    const bundle = bundleBytes(label);
    const image = randomBytes(200);
    const launchAsset = assetOf(bundle, {
      fileExtension: '.bundle',
      contentType: 'application/javascript',
    });
    const asset = assetOf(image);
    for (const [bytes, contentType] of [
      [bundle, 'application/javascript'],
      [image, 'image/png'],
    ] as const)
      assert.equal((await upload(bytes, { contentType })).status, 201);
    const manifest = manifestText({
      id,
      createdAt,
      runtimeVersion,
      launchAsset,
      assets: [asset],
    });
    const published = await publish({ platform, runtimeVersion, manifest });
    assert.equal(published.status, 201, published.body.toString());
    return { id, manifest, launchAsset, asset, bundle, image };
  }

  return {
    server,
    memory,
    db,
    dir,
    base,
    json,
    ask,
    upload,
    publish,
    rollback,
    release,
  };
}

/** O servidor que os testes dividem (cada um com o próprio runtime). */
let sharedServer: Awaited<ReturnType<typeof serve>> | null = null;
const app = async () => (sharedServer ??= await serve());

/** A parte de uma resposta multipart com a assinatura conferida pela chave. */
function signedPart(
  answer: {
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  },
  name: string,
  signer: OtaKeys = keys,
) {
  const parts = readMultipart(
    answer.headers['content-type'] as string,
    answer.body,
  );
  const part = parts.find(
    item => item.headers['content-disposition'] === `form-data; name="${name}"`,
  );
  assert.ok(part, `no ${name} part`);
  assert.equal(part.headers['content-type'], 'application/json');
  const signature = signatureOf(part.headers['expo-signature']);
  assert.equal(
    verify(
      'sha256',
      Buffer.from(part.body, 'utf8'),
      signer.publicKey,
      Buffer.from(signature, 'base64'),
    ),
    true,
    'the signature verifies with the certificate key',
  );
  return { parts, part };
}

function assertProtocolHeaders(headers: Record<string, unknown>) {
  assert.equal(headers['expo-protocol-version'], '1');
  assert.equal(headers['expo-sfv-version'], '0');
  assert.equal(headers['cache-control'], 'private, max-age=0');
}

// ---------------------------------------------------------------- o domínio

test('asset hashes and signatures must be canonical', () => {
  const hash = assetHashOf(Buffer.from('AO UERJ'));
  assert.equal(hash.length, 43);
  assert.equal(isAssetHash(hash), true);
  // o último caractere leva 2 bits que sobram, zerados na forma canônica: o
  // "B" os liga (dá os mesmos bytes de outro hash, com outro nome)
  assert.equal(isAssetHash(`${hash.slice(0, 42)}B`), false);
  assert.equal(isAssetHash(`${hash}=`), false);
  assert.equal(isAssetHash(hash.replace(/./, '+')), false);

  const signature = signText(keys.privateKey, 'texto');
  assert.equal(isSignature(signature), true);
  assert.equal(isSignature(signature.replace(/=+$/, '')), false);
  assert.equal(isSignature(`${signature}\n`), false);
  assert.equal(isSignature(''), false);
});

test('dates must be ISO 8601 with milliseconds, as the Android client parses them', () => {
  assert.equal(
    timestampOf('2026-11-06T12:00:00.000Z')?.toISOString(),
    '2026-11-06T12:00:00.000Z',
  );
  for (const bad of [
    '2026-11-06T12:00:00Z',
    '2026-11-06T12:00:00.000+00:00',
    '2026-02-30T12:00:00.000Z',
    1762430400000,
    null,
  ])
    assert.equal(timestampOf(bad), null, String(bad));
});

const sampleAssets = () => {
  const launchAsset = assetOf(bundleBytes('sample'), {
    fileExtension: '.bundle',
    contentType: 'application/javascript',
  });
  return { launchAsset, image: assetOf(randomBytes(64)) };
};

test('a manifest is read for its id, date and files, and the rules the app depends on', () => {
  const { launchAsset, image } = sampleAssets();
  const id = randomUUID().toUpperCase();
  const facts = readManifest(
    manifestText({
      id,
      createdAt: '2026-11-06T12:00:00.000Z',
      runtimeVersion: '2.16.0',
      launchAsset,
      assets: [image, image],
    }),
    { runtimeVersion: '2.16.0', origin: ORIGIN },
  );
  assert.deepEqual(facts, {
    updateId: id.toLowerCase(),
    createdAt: new Date('2026-11-06T12:00:00.000Z'),
    launchAsset: launchAsset.hash,
    assets: [launchAsset.hash, image.hash],
  });

  const refuse = (
    change: (manifest: Record<string, any>) => void,
    pattern: RegExp,
    {
      origin = ORIGIN,
      code = 'invalid_manifest',
    }: { origin?: string | null; code?: string } = {},
  ) => {
    const manifest = JSON.parse(
      manifestText({
        createdAt: '2026-11-06T12:00:00.000Z',
        runtimeVersion: '2.16.0',
        launchAsset: { ...launchAsset },
        assets: [{ ...image }],
      }),
    ) as Record<string, any>;
    change(manifest);
    assert.throws(
      () =>
        readManifest(JSON.stringify(manifest), {
          runtimeVersion: '2.16.0',
          origin,
        }),
      (err: unknown) =>
        err instanceof DomainError &&
        err.code === code &&
        pattern.test(err.message),
    );
  };
  refuse(m => (m.id = 'not-a-uuid'), /id must be a UUID/);
  refuse(m => (m.createdAt = '2026-11-06T12:00:00Z'), /milliseconds/);
  refuse(m => (m.runtimeVersion = '2.15.0'), /runtimeVersion/, {
    code: 'runtime_mismatch',
  });
  refuse(m => delete m.launchAsset, /launchAsset: must be an object/);
  refuse(m => (m.launchAsset.hash = 'abc'), /launchAsset: hash/);
  refuse(m => (m.assets[0].key = '../x'), /assets\[0\]: key/);
  refuse(m => delete m.assets[0].fileExtension, /assets\[0\]: fileExtension/);
  refuse(m => (m.assets[0].fileExtension = 'png'), /fileExtension/);
  refuse(m => (m.assets = {}), /assets must be a list/);
  // a URL é a deste arquivo, aqui, na forma canônica
  refuse(
    m => (m.assets[0].url = `${ORIGIN}/aouerj/ota/assets/${launchAsset.hash}`),
    /assets\[0\]: url/,
  );
  refuse(m => (m.assets[0].url = `${m.assets[0].url}?v=1`), /url/);
  refuse(
    m =>
      (m.assets[0].url = m.assets[0].url.replace(
        ORIGIN,
        'https://evil.example',
      )),
    /url must be https:\/\/pitrol\.dev\/aouerj\/ota\/assets\//,
  );
  refuse(
    m => (m.assets[0].url = m.assets[0].url.replace('https:', 'ftp:')),
    /url/,
    {
      origin: null,
    },
  );
  refuse(m => (m.assets[0].key = m.launchAsset.key), /two different files/);
  refuse(m => (m.metadata = { channel: 1 }), /metadata/);
  refuse(m => (m.extra = []), /extra/);
  assert.throws(
    () => readManifest('{', { runtimeVersion: '1', origin: null }),
    /not JSON/,
  );

  // fora da produção, qualquer origem (o QA com um servidor local)
  const local = assetOf(randomBytes(32), { origin: 'http://localhost:3300' });
  assert.equal(
    readManifest(
      manifestText({
        createdAt: '2026-11-06T12:00:00.000Z',
        runtimeVersion: '1',
        launchAsset: local,
      }),
      { runtimeVersion: '1', origin: null },
    ).launchAsset,
    local.hash,
  );
});

test('only rollBackToEmbedded directives with a precise commitTime are published', () => {
  const at = new Date('2026-11-06T12:00:00.000Z');
  assert.deepEqual(readDirective(rollbackText(at)), { commitTime: at });
  for (const [text, pattern] of [
    [NO_UPDATE_AVAILABLE_DIRECTIVE, /answer of the server/],
    ['{"type":"somethingElse"}', /rollBackToEmbedded/],
    ['{"type":"rollBackToEmbedded"}', /commitTime/],
    [
      '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-11-06T12:00:00Z"}}',
      /milliseconds/,
    ],
    ['[]', /JSON object/],
    ['nope', /not JSON/],
  ] as const)
    assert.throws(
      () => readDirective(text),
      (err: unknown) =>
        err instanceof DomainError &&
        err.code === 'invalid_directive' &&
        pattern.test(err.message),
    );
});

test('the answer is the latest manifest, nothing new for whoever runs it, and a rollback for everyone', () => {
  const entry = (
    kind: OtaEntry['kind'],
    updateId: string | null,
  ): OtaEntry => ({
    id: '1',
    platform: 'android',
    runtimeVersion: '1',
    kind,
    body: `${kind}-body`,
    signature: 'c2ln',
    bodyHash: 'hash',
    updateId,
    commitTime: new Date(0),
    launchAsset: null,
    assets: [],
    publishedAt: new Date(0),
  });
  const update = entry('manifest', 'a1b2c3d4-0000-4000-8000-000000000000');
  assert.deepEqual(answerFor(update, null, 'bm8='), {
    kind: 'manifest',
    body: 'manifest-body',
    signature: 'c2ln',
  });
  assert.deepEqual(answerFor(update, update.updateId, 'bm8='), {
    kind: 'noUpdate',
    body: NO_UPDATE_AVAILABLE_DIRECTIVE,
    signature: 'bm8=',
  });
  assert.equal(answerFor(null, null, null).kind, 'noUpdate');
  // a volta vai até para quem roda o JS da loja (um update baixado ganharia dele)
  assert.equal(
    answerFor(entry('directive', null), update.updateId, null).kind,
    'directive',
  );
});

test('the multipart writer puts each part between CRLF delimiters, with lowercase headers', () => {
  const { contentType, body } = multipartMixed(
    [
      {
        name: 'manifest',
        contentType: 'application/json',
        headers: { 'expo-signature': 'sig="c2ln", keyid="main"' },
        body: '{"id":"x"}',
      },
      { name: 'extensions', contentType: 'application/json', body: '{}' },
    ],
    () => 'B0UNDARY',
  );
  assert.equal(contentType, 'multipart/mixed; boundary=B0UNDARY');
  assert.equal(
    body.toString('utf8'),
    [
      '--B0UNDARY',
      'content-type: application/json',
      'content-disposition: form-data; name="manifest"',
      'expo-signature: sig="c2ln", keyid="main"',
      '',
      '{"id":"x"}',
      '--B0UNDARY',
      'content-type: application/json',
      'content-disposition: form-data; name="extensions"',
      '',
      '{}',
      '--B0UNDARY--',
      '',
    ].join('\r\n'),
  );
  // um delimitador que aparece num corpo é trocado
  const clash = multipartMixed(
    [{ name: 'directive', contentType: 'application/json', body: 'ota-x' }],
    () => 'ota-x',
  );
  assert.notEqual(clash.contentType, 'multipart/mixed; boundary=ota-x');
});

// ----------------------------------------------------------- o manifesto (app)

test('an unknown runtime gets a signed noUpdateAvailable directive, per protocol 1', async () => {
  const { ask } = await app();
  const answer = await ask({ 'expo-runtime-version': runtime('unknown') });

  assert.equal(answer.status, 200);
  assertProtocolHeaders(answer.headers);
  assert.match(
    answer.headers['content-type'] ?? '',
    /^multipart\/mixed; boundary=[A-Za-z0-9-]+$/,
  );
  const { parts, part } = signedPart(answer, 'directive');
  assert.equal(parts.length, 1);
  assert.deepEqual(Object.keys(part.headers), [
    'content-type',
    'content-disposition',
    'expo-signature',
  ]);
  assert.equal(part.body, '{"type":"noUpdateAvailable"}');
});

test('without the pre-made noUpdateAvailable signature, no update is a 204 with the protocol headers', async () => {
  const { ask } = await serve({ noUpdateSignature: null });
  const answer = await ask({ 'expo-runtime-version': runtime('unsigned') });

  assert.equal(answer.status, 204);
  assertProtocolHeaders(answer.headers);
  assert.equal(answer.body.length, 0);
  assert.equal(answer.headers['content-type'], undefined);
});

test('a published update is served byte for byte, with its signature and the extensions part', async () => {
  const { ask, release } = await app();
  const runtimeVersion = runtime('served');
  const { id, manifest } = await release({ runtimeVersion });

  const answer = await ask({ 'expo-runtime-version': runtimeVersion });
  assert.equal(answer.status, 200);
  assertProtocolHeaders(answer.headers);
  const { parts, part } = signedPart(answer, 'manifest');
  assert.equal(part.body, manifest);
  assert.deepEqual(
    parts.map(item => item.headers['content-disposition']),
    ['form-data; name="manifest"', 'form-data; name="extensions"'],
  );
  const extensions = parts[1];
  assert.equal(extensions.headers['content-type'], 'application/json');
  assert.equal(extensions.headers['expo-signature'], undefined);
  assert.deepEqual(JSON.parse(extensions.body), { assetRequestHeaders: {} });

  // quem já roda este update (a caixa do UUID não importa) não baixa de novo
  for (const current of [id, id.toUpperCase()]) {
    const again = await ask({
      'expo-runtime-version': runtimeVersion,
      'expo-current-update-id': current,
      'expo-embedded-update-id': randomUUID(),
    });
    assert.equal(
      signedPart(again, 'directive').part.body,
      NO_UPDATE_AVAILABLE_DIRECTIVE,
    );
  }
  // outra plataforma e outro runtime não veem este update
  for (const headers of [
    { 'expo-runtime-version': runtimeVersion, 'expo-platform': 'ios' },
    { 'expo-runtime-version': `${runtimeVersion}-other` },
  ]) {
    const other = await ask(headers);
    assert.equal(
      signedPart(other, 'directive').part.body,
      NO_UPDATE_AVAILABLE_DIRECTIVE,
    );
  }
});

test('the latest publication wins, and a rollBackToEmbedded on top goes to every device until a newer update', async () => {
  const { ask, release, rollback } = await app();
  const runtimeVersion = runtime('latest');
  const first = await release({ runtimeVersion });
  const second = await release({ runtimeVersion });

  const latest = await ask({
    'expo-runtime-version': runtimeVersion,
    'expo-current-update-id': first.id,
  });
  assert.equal(signedPart(latest, 'manifest').part.body, second.manifest);

  const directive = rollbackText(nextDate());
  const published = await rollback({ runtimeVersion, directive });
  assert.equal(published.status, 201);
  assert.equal(published.json.kind, 'directive');
  for (const current of [second.id, randomUUID(), undefined]) {
    const answer = await ask({
      'expo-runtime-version': runtimeVersion,
      'expo-current-update-id': current,
    });
    const { parts, part } = signedPart(answer, 'directive');
    assert.equal(parts.length, 1);
    assert.equal(part.body, directive);
  }

  const third = await release({ runtimeVersion });
  const answer = await ask({ 'expo-runtime-version': runtimeVersion });
  assert.equal(signedPart(answer, 'manifest').part.body, third.manifest);
});

test('the manifest route answers 406 to other protocols and 400 to a bad platform or runtime', async () => {
  const { ask } = await app();
  const runtimeVersion = runtime('headers');
  const cases: Array<[Record<string, string | undefined>, number, string]> = [
    [{ 'expo-protocol-version': undefined }, 406, 'unsupported_protocol'],
    [{ 'expo-protocol-version': '0' }, 406, 'unsupported_protocol'],
    [{ accept: 'application/json' }, 406, 'not_acceptable'],
    [{ 'expo-platform': 'web' }, 400, 'invalid_request'],
    [{ 'expo-platform': undefined }, 400, 'invalid_request'],
    [{ 'expo-runtime-version': undefined }, 400, 'invalid_request'],
    [{ 'expo-runtime-version': 'two words' }, 400, 'invalid_request'],
  ];
  for (const [headers, status, error] of cases) {
    const answer = await ask({
      'expo-runtime-version': runtimeVersion,
      ...headers,
    });
    assert.equal(answer.status, status, JSON.stringify(headers));
    assert.equal(JSON.parse(answer.body.toString()).error, error);
    assertProtocolHeaders(answer.headers);
  }
  // sem accept, qualquer formato vale
  const anything = await ask({
    'expo-runtime-version': runtimeVersion,
    accept: undefined,
  });
  assert.equal(anything.status, 200);
});

test('without the database the manifest is a 503, which the app treats as a failed check, and files still load', async () => {
  const offline = await serve();
  const runtimeVersion = runtime('offline');
  const { launchAsset } = await offline.release({ runtimeVersion });
  offline.db.state.ready = false;

  const answer = await offline.ask({ 'expo-runtime-version': runtimeVersion });
  assert.equal(answer.status, 503);
  assertProtocolHeaders(answer.headers);
  assert.equal(
    JSON.parse(answer.body.toString()).error,
    'database_unavailable',
  );

  const publish = await offline.publish({ runtimeVersion, manifest: '{}' });
  assert.equal(publish.status, 503);

  const file = await rawRequest(
    `${offline.base}/aouerj/ota/assets/${launchAsset.hash}`,
  );
  assert.equal(file.status, 200);
});

// --------------------------------------------------------------- os arquivos

test('files are served by hash with the stored type, a long cache and the encoding the app accepts', async () => {
  const { base, upload } = await app();
  const bundle = bundleBytes(`files-${randomUUID()}`, 2000);
  const hash = assetHashOf(bundle);
  assert.equal(
    (await upload(bundle, { contentType: 'application/javascript' })).status,
    201,
  );
  const url = `${base}/aouerj/ota/assets/${hash}`;

  // o Android manda "zstd, br, gzip"; o servidor tem Brotli e gzip
  const decode = {
    br: brotliDecompressSync,
    gzip: gunzipSync,
    identity: (bytes: Buffer) => bytes,
  };
  for (const [acceptEncoding, encoding] of [
    ['zstd, br, gzip', 'br'],
    ['gzip', 'gzip'],
    ['gzip;q=0.5, br;q=0.1', 'gzip'],
    ['identity', 'identity'],
    [undefined, 'identity'],
  ] as const) {
    const answer = await rawRequest(url, {
      headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {},
    });
    assert.equal(answer.status, 200);
    assert.equal(answer.headers['content-type'], 'application/javascript');
    assert.equal(
      answer.headers['content-encoding'],
      encoding === 'identity' ? undefined : encoding,
    );
    assert.equal(Number(answer.headers['content-length']), answer.body.length);
    assert.equal(
      answer.headers['cache-control'],
      'public, max-age=31536000, immutable',
    );
    assert.equal(answer.headers.vary, 'accept-encoding');
    assert.match(String(answer.headers['content-security-policy']), /sandbox/);
    const content = decode[encoding](answer.body);
    assert.equal(assetHashOf(content), hash);
    if (encoding !== 'identity')
      assert.ok(answer.body.length < bundle.length / 2);
  }

  const head = await rawRequest(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers['content-length']), bundle.length);
  assert.equal(head.body.length, 0);

  const cached = await rawRequest(url, {
    headers: { 'if-none-match': head.headers.etag ?? '' },
  });
  assert.equal(cached.status, 304);

  // um arquivo pequeno, ou que não comprime, vai sempre como está
  const image = randomBytes(5000);
  await upload(image, { contentType: 'image/png' });
  const raw = await rawRequest(
    `${base}/aouerj/ota/assets/${assetHashOf(image)}`,
    {
      headers: { 'accept-encoding': 'br, gzip' },
    },
  );
  assert.equal(raw.headers['content-encoding'], undefined);
  assert.deepEqual(raw.body, image);

  for (const missing of [assetHashOf(randomBytes(8)), 'not-a-hash']) {
    const answer = await rawRequest(`${base}/aouerj/ota/assets/${missing}`);
    assert.equal(answer.status, 404);
    assert.equal(answer.headers['cache-control'], 'no-store');
    assert.equal(JSON.parse(answer.body.toString()).error, 'asset_not_found');
  }
});

test('uploading the same file again changes nothing and keeps the first type', async () => {
  const { base, upload } = await app();
  const bytes = randomBytes(3000);
  const first = await upload(bytes, { contentType: 'image/png' });
  assert.equal(first.status, 201);
  assert.deepEqual(JSON.parse(first.body.toString()), {
    status: 'created',
    hash: assetHashOf(bytes),
    contentType: 'image/png',
    size: 3000,
  });

  const again = await upload(bytes, { contentType: 'image/webp' });
  assert.equal(again.status, 200);
  assert.equal(JSON.parse(again.body.toString()).status, 'exists');
  assert.equal(JSON.parse(again.body.toString()).contentType, 'image/png');

  const served = await rawRequest(
    `${base}/aouerj/ota/assets/${assetHashOf(bytes)}`,
  );
  assert.equal(served.headers['content-type'], 'image/png');
  assert.deepEqual(served.body, bytes);
});

test('uploads are refused without the right signature, with another body, a bad type or too big', async () => {
  const { upload } = await app();
  const bytes = randomBytes(100);
  const hash = assetHashOf(bytes);
  const refusals: Array<[Parameters<typeof upload>[1], number, string]> = [
    [{ signature: null }, 403, 'invalid_signature'],
    [
      { signature: signText(keys.privateKey, assetHashOf(randomBytes(4))) },
      403,
      'invalid_signature',
    ],
    [
      { signature: signText(strangerKeys.privateKey, hash) },
      403,
      'invalid_signature',
    ],
    [{ signature: 'bm90IGEgc2lnbmF0dXJl' }, 403, 'invalid_signature'],
    [{ signature: '***' }, 403, 'invalid_signature'],
    [{ contentType: null }, 400, 'invalid_request'],
    [{ contentType: 'png' }, 400, 'invalid_request'],
    [
      { hash: 'abc', signature: signText(keys.privateKey, 'abc') },
      400,
      'invalid_request',
    ],
  ];
  for (const [options, status, error] of refusals) {
    const answer = await upload(bytes, options);
    assert.equal(answer.status, status, JSON.stringify(options));
    assert.equal(JSON.parse(answer.body.toString()).error, error);
  }

  // a assinatura certa, mas outro corpo
  const other = randomBytes(100);
  const mismatch = await upload(other, {
    hash,
    signature: signText(keys.privateKey, hash),
  });
  assert.equal(mismatch.status, 422);
  assert.equal(JSON.parse(mismatch.body.toString()).error, 'hash_mismatch');

  const small = await serve({ env: { OTA_ASSET_LIMIT_MB: '1' } });
  const big = randomBytes(1024 * 1024 + 1);
  const tooBig = await small.upload(big);
  assert.equal(tooBig.status, 413);
  assert.equal(JSON.parse(tooBig.body.toString()).error, 'payload_too_large');
  assert.equal((await small.upload(big.subarray(0, 1024 * 1024))).status, 201);
});

// ------------------------------------------------------------- as publicações

test('publishing refuses a bad signature, unknown files and a manifest of another runtime or platform', async () => {
  const { publish, upload } = await app();
  const runtimeVersion = runtime('refusals');
  const bundle = bundleBytes(`refusals-${randomUUID()}`);
  const launchAsset = assetOf(bundle, {
    fileExtension: '.bundle',
    contentType: 'application/javascript',
  });
  const manifest = manifestText({
    createdAt: nextDate(),
    runtimeVersion,
    launchAsset,
  });

  const expect = async (
    answer: Promise<{
      status: number;
      json: { error: string; message: string };
    }>,
    status: number,
    error: string,
  ) => {
    const { status: got, json } = await answer;
    assert.equal(got, status, json.message);
    assert.equal(json.error, error, json.message);
  };

  await expect(
    publish({
      runtimeVersion,
      manifest,
      signature: signText(keys.privateKey, `${manifest} `),
    }),
    403,
    'invalid_signature',
  );
  await expect(
    publish({
      runtimeVersion,
      manifest,
      signature: signText(strangerKeys.privateKey, manifest),
    }),
    403,
    'invalid_signature',
  );
  // o arquivo ainda não foi enviado
  await expect(publish({ runtimeVersion, manifest }), 422, 'unknown_asset');
  // assinado para um runtime, publicado em outro
  await expect(
    publish({ runtimeVersion: `${runtimeVersion}-b`, manifest }),
    422,
    'runtime_mismatch',
  );

  assert.equal(
    (await upload(bundle, { contentType: 'application/javascript' })).status,
    201,
  );
  assert.equal((await publish({ runtimeVersion, manifest })).status, 201);
  // o mesmo manifesto (público: o app o recebe) não vira o do iPhone
  await expect(
    publish({ platform: 'ios', runtimeVersion, manifest }),
    422,
    'platform_mismatch',
  );

  const future = manifestText({
    createdAt: new Date(Date.now() + 2 * 60 * 60 * SECOND),
    runtimeVersion,
    launchAsset,
  });
  await expect(
    publish({ runtimeVersion, manifest: future }),
    422,
    'invalid_manifest',
  );

  const elsewhere = manifestText({
    createdAt: nextDate(),
    runtimeVersion,
    launchAsset: {
      ...launchAsset,
      url: `${ORIGIN}/aouerj/ota/assets/${assetHashOf(randomBytes(4))}`,
    },
  });
  await expect(
    publish({ runtimeVersion, manifest: elsewhere }),
    422,
    'invalid_manifest',
  );

  // o corpo do pedido
  await expect(
    publish({ platform: 'web', runtimeVersion, manifest }),
    400,
    'invalid_request',
  );
  await expect(
    publish({ runtimeVersion: 'two words', manifest }),
    400,
    'invalid_request',
  );
  await expect(
    publish({ runtimeVersion, manifest: 'x'.repeat(OTA_LIMITS.manifest + 1) }),
    400,
    'invalid_request',
  );
  const { json } = await app();
  await expect(
    json('POST', '/aouerj/ota/updates', {
      platform: 'android',
      runtimeVersion,
      manifest: 'x'.repeat(2.1 * 1024 * 1024),
      signature: 'c2ln',
    }),
    413,
    'payload_too_large',
  );
});

test('publishing refuses anything older than the latest publication and a reused update id', async () => {
  const { publish, release, rollback } = await app();
  const runtimeVersion = runtime('order');
  const older = nextDate();
  const newer = nextDate();
  const latest = await release({ runtimeVersion, createdAt: newer });

  // um manifesto novo (outro id), mas de antes do que está no ar
  const stale = await release({ runtimeVersion: `${runtimeVersion}-other` });
  const staleManifest = manifestText({
    createdAt: older,
    runtimeVersion,
    launchAsset: stale.launchAsset,
  });
  const late = await publish({ runtimeVersion, manifest: staleManifest });
  assert.equal(late.status, 409);
  assert.equal(late.json.error, 'not_newer');

  // o mesmo id com outro manifesto
  const conflict = await publish({
    runtimeVersion,
    manifest: manifestText({
      id: latest.id,
      createdAt: nextDate(),
      runtimeVersion,
      launchAsset: stale.launchAsset,
    }),
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.error, 'update_conflict');

  const oldRollback = await rollback({
    runtimeVersion,
    directive: rollbackText(older),
  });
  assert.equal(oldRollback.status, 409);
  assert.equal(oldRollback.json.error, 'not_newer');
});

test('directives are refused with a bad signature, another type or an imprecise commitTime', async () => {
  const { rollback } = await app();
  const runtimeVersion = runtime('directives');
  const directive = rollbackText(nextDate());
  const cases: Array<[Parameters<typeof rollback>[0], number, string]> = [
    [
      {
        runtimeVersion,
        directive,
        signature: signText(strangerKeys.privateKey, directive),
      },
      403,
      'invalid_signature',
    ],
    [
      { runtimeVersion, directive: NO_UPDATE_AVAILABLE_DIRECTIVE },
      422,
      'invalid_directive',
    ],
    [
      {
        runtimeVersion,
        directive:
          '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-11-06T12:00:00Z"}}',
      },
      422,
      'invalid_directive',
    ],
    [
      {
        runtimeVersion,
        directive: rollbackText(new Date(Date.now() + 2 * 60 * 60 * SECOND)),
      },
      422,
      'invalid_directive',
    ],
    [{ runtimeVersion, platform: 'web', directive }, 400, 'invalid_request'],
  ];
  for (const [input, status, error] of cases) {
    const answer = await rollback(input);
    assert.equal(answer.status, status, answer.json.message);
    assert.equal(answer.json.error, error);
  }
});

test('publishing the same manifest or directive again changes nothing, even after a rollback', async () => {
  const { ask, publish, release, rollback, memory } = await app();
  const runtimeVersion = runtime('again');
  const update = await release({ runtimeVersion });

  const again = await publish({ runtimeVersion, manifest: update.manifest });
  assert.equal(again.status, 200);
  assert.equal(again.json.status, 'already_published');
  assert.equal(again.json.updateId, update.id);

  const directive = rollbackText(nextDate());
  assert.equal((await rollback({ runtimeVersion, directive })).status, 201);
  const repeated = await rollback({ runtimeVersion, directive });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.json.status, 'already_published');

  // o manifesto de antes, repetido (alguém o guardou), não passa a frente da volta
  assert.equal(
    (await publish({ runtimeVersion, manifest: update.manifest })).status,
    200,
  );
  const answer = await ask({ 'expo-runtime-version': runtimeVersion });
  assert.equal(signedPart(answer, 'directive').part.body, directive);
  assert.equal(
    memory.data.otaEntries.filter(
      entry => entry.runtimeVersion === runtimeVersion,
    ).length,
    2,
  );
});

test('without a certificate publishing is off (503), and no update is still answered', async () => {
  const off = await serve({ certificate: null, noUpdateSignature: null });
  const bytes = randomBytes(10);
  const upload = await off.upload(bytes);
  assert.equal(upload.status, 503);
  assert.equal(
    JSON.parse(upload.body.toString()).error,
    'ota_publishing_unavailable',
  );
  const publish = await off.publish({ runtimeVersion: '1', manifest: '{}' });
  assert.equal(publish.status, 503);
  assert.equal(publish.json.error, 'ota_publishing_unavailable');

  const answer = await off.ask({ 'expo-runtime-version': '1' });
  assert.equal(answer.status, 204);
});

test('a noUpdateAvailable signature that does not match the certificate stops the server from starting', () => {
  const wrong = noUpdateSignatureOf(strangerKeys);
  assert.throws(
    () =>
      createServer(testConfig({ OTA_DIR: temporaryDir() }), silentLogger, {
        database: switchableDatabase().database,
        repositories: memoryRepositories().repositories,
        ota: { certificate: keys.certificate, noUpdateSignature: wrong },
      }),
    /noUpdateAvailable signature does not match/,
  );
  assert.throws(
    () =>
      createOtaUpdates({
        entries: memoryOtaEntries().repository,
        assets: createFileOtaAssetStore(temporaryDir()),
        verifier: null,
        noUpdateSignature: wrong,
        assetOrigin: null,
      }),
    /does not match/,
  );
});

test('the manifest and the publishing routes have their own limits per IP', async () => {
  const limited = await serve({
    env: {
      OTA_MANIFEST_LIMIT_PER_MINUTE: '2',
      OTA_PUBLISH_LIMIT_PER_MINUTE: '1',
    },
  });
  const statuses = [];
  for (let i = 0; i < 3; i += 1)
    statuses.push(
      (await limited.ask({ 'expo-runtime-version': 'limit' })).status,
    );
  assert.deepEqual(statuses, [200, 200, 429]);

  assert.equal((await limited.upload(randomBytes(10))).status, 201);
  const second = await limited.upload(randomBytes(10));
  assert.equal(second.status, 429);
  assert.equal(JSON.parse(second.body.toString()).error, 'rate_limited');
  // os arquivos não têm limite: uma atualização baixa vários de uma vez
  for (let i = 0; i < 5; i += 1)
    assert.equal(
      (
        await rawRequest(
          `${limited.base}/aouerj/ota/assets/${assetHashOf(randomBytes(8))}`,
        )
      ).status,
      404,
    );
});

test('the log of the OTA routes keeps no IP, user agent, signature or manifest', async () => {
  const lines: string[] = [];
  const logger = pino(
    { level: 'info' },
    new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    }),
  );
  const logged = await serve({ logger });
  // só o que as rotas escreveram
  lines.length = 0;
  const runtimeVersion = runtime('log');
  const { manifest } = await logged.release({ runtimeVersion });
  await logged.ask({
    'expo-runtime-version': runtimeVersion,
    'user-agent': 'okhttp/5.1.0',
  });
  await logged.upload(randomBytes(10), { signature: 'c2lnbmF0dXJl' });

  const log = lines.join('');
  assert.match(log, /"path":"\/aouerj\/ota\/manifest"/);
  assert.match(log, /"path":"\/aouerj\/ota\/updates"/);
  for (const secret of [
    '127.0.0.1',
    'okhttp',
    'user-agent',
    'expo-ota-signature',
    'c2lnbmF0dXJl',
    manifest.slice(0, 40),
    runtimeVersion,
  ])
    assert.equal(log.includes(secret), false, secret);
});

// -------------------------------------------------------------- a limpeza

test('cleanup keeps the files of the last three updates of each runtime and anything recent', async () => {
  const dir = temporaryDir();
  const clock = manualClock(Date.now());
  const memory = memoryOtaEntries();
  const store = createFileOtaAssetStore(dir, { now: clock.now });
  const ota = createOtaUpdates({
    entries: memory.repository,
    assets: store,
    verifier: createOtaSignatureVerifier(keys.certificate),
    noUpdateSignature: null,
    assetOrigin: ORIGIN,
    now: clock.now,
  });
  const put = async (bytes: Buffer, contentType = 'image/png') => {
    const hash = assetHashOf(bytes);
    await ota.uploadAsset({
      hash,
      signature: signText(keys.privateKey, hash),
      contentType,
      content: bytes,
    });
    return hash;
  };
  const shared = randomBytes(2000);
  const sharedAsset = assetOf(shared);
  await put(shared);
  const publishWith = async (runtimeVersion: string, label: string) => {
    const bundle = bundleBytes(label);
    await put(bundle, 'application/javascript');
    const launchAsset = assetOf(bundle, {
      fileExtension: '.bundle',
      contentType: 'application/javascript',
    });
    const manifest = manifestText({
      createdAt: new Date(clock.now() - DAY + memory.entries.length * SECOND),
      runtimeVersion,
      launchAsset,
      assets: [sharedAsset],
    });
    await ota.publishUpdate({
      platform: 'android',
      runtimeVersion,
      manifest,
      signature: signText(keys.privateKey, manifest),
    });
    return launchAsset.hash;
  };

  const old = await publishWith('1.0', 'old-runtime');
  const bundles: string[] = [];
  for (const label of ['u1', 'u2', 'u3', 'u4'])
    bundles.push(await publishWith('2.0', label));
  const orphan = await put(randomBytes(500));

  clock.advance(OTA_ASSET_GRACE_MS + DAY);
  const recent = await put(randomBytes(500));
  bundles.push(await publishWith('2.0', 'u5'));
  // a volta não tira os arquivos dos updates de antes dela
  const directive = rollbackText(new Date(clock.now() - DAY / 2));
  await ota.publishDirective({
    platform: 'android',
    runtimeVersion: '2.0',
    directive,
    signature: signText(keys.privateKey, directive),
  });

  const present = async (hash: string) => (await ota.asset(hash)) !== null;
  assert.deepEqual(
    await Promise.all(bundles.map(present)),
    [false, false, true, true, true],
    'u1 and u2 left, u3 to u5 stay',
  );
  assert.equal(
    await present(assetHashOf(shared)),
    true,
    'the shared file stays',
  );
  assert.equal(
    await present(old),
    true,
    'the only update of an older runtime stays',
  );
  assert.equal(
    await present(orphan),
    false,
    'an old file no manifest uses left',
  );
  assert.equal(await present(recent), true, 'a recent file stays');
  assert.equal(await ota.cleanup(), 0);
  // o .json saiu junto com o arquivo e as versões comprimidas
  const left = readdirSync(path.join(dir, 'assets'));
  const removedName = Buffer.from(bundles[0], 'base64url').toString('hex');
  assert.equal(
    left.some(name => name.startsWith(removedName)),
    false,
  );
});

test('uploading an old file again renews it, so cleanup keeps it for the manifest that comes next', async () => {
  const clock = manualClock(Date.now());
  const ota = createOtaUpdates({
    entries: memoryOtaEntries().repository,
    assets: createFileOtaAssetStore(temporaryDir(), { now: clock.now }),
    verifier: createOtaSignatureVerifier(keys.certificate),
    noUpdateSignature: null,
    assetOrigin: null,
    now: clock.now,
  });
  const bytes = randomBytes(300);
  const hash = assetHashOf(bytes);
  const upload = () =>
    ota.uploadAsset({
      hash,
      signature: signText(keys.privateKey, hash),
      contentType: 'image/png',
      content: bytes,
    });
  assert.equal((await upload()).created, true);
  clock.advance(OTA_ASSET_GRACE_MS + DAY);
  assert.equal((await upload()).created, false);
  assert.equal(await ota.cleanup(), 0);
  assert.notEqual(await ota.asset(hash), null);

  clock.advance(OTA_ASSET_GRACE_MS + DAY);
  assert.equal(await ota.cleanup(), 1);
  assert.equal(await ota.asset(hash), null);
});

test('two identical publications at the same time save one entry', async () => {
  const memory = memoryOtaEntries();
  const store = createFileOtaAssetStore(temporaryDir());
  const ota = createOtaUpdates({
    entries: memory.repository,
    assets: store,
    verifier: createOtaSignatureVerifier(keys.certificate),
    noUpdateSignature: null,
    assetOrigin: null,
  });
  const bundle = bundleBytes('race');
  const hash = assetHashOf(bundle);
  await ota.uploadAsset({
    hash,
    signature: signText(keys.privateKey, hash),
    contentType: 'application/javascript',
    content: bundle,
  });
  const manifest = manifestText({
    createdAt: nextDate(),
    runtimeVersion: 'race',
    launchAsset: assetOf(bundle, {
      fileExtension: '.bundle',
      contentType: 'application/javascript',
    }),
  });
  const input = {
    platform: 'android' as const,
    runtimeVersion: 'race',
    manifest,
    signature: signText(keys.privateKey, manifest),
  };
  const results = await Promise.all([
    ota.publishUpdate(input),
    ota.publishUpdate(input),
  ]);
  assert.deepEqual(
    results.map(result => result.created).sort((a, b) => Number(a) - Number(b)),
    [false, true],
  );
  assert.equal(memory.entries.length, 1);
});

// ------------------------------------------------------------ a configuração

test('the OTA files sit next to the reports, and the asset origin is pinned only in production', () => {
  const local = loadConfig({});
  assert.equal(local.ota.dir, path.join(path.dirname(local.reportsDir), 'ota'));
  assert.equal(local.ota.assetOrigin, null);
  assert.equal(local.ota.assetLimitBytes, 32 * 1024 * 1024);
  assert.equal(local.ota.publishPerMinute, 600);
  assert.equal(local.ota.manifestPerMinute, 1200);

  // na VM: REPORTS_DIR=~/ao-uerj-server/shared/AOreports, sem OTA_DIR
  const sharedDir = path.join(tmpdir(), 'ao-uerj-server', 'shared');
  const production = loadConfig({
    NODE_ENV: 'production',
    REPORTS_DIR: path.join(sharedDir, 'AOreports'),
  });
  assert.equal(production.ota.dir, path.join(sharedDir, 'ota'));
  assert.equal(production.ota.assetOrigin, 'https://pitrol.dev');
  assert.equal(
    loadConfig({
      NODE_ENV: 'production',
      PUBLIC_URL: 'https://example.org/app',
    }).ota.assetOrigin,
    'https://example.org',
  );
  assert.equal(loadConfig({ OTA_DIR: sharedDir }).ota.dir, sharedDir);
  assert.equal(
    loadConfig({ OTA_ASSET_LIMIT_MB: '2' }).ota.assetLimitBytes,
    2 * 1024 * 1024,
  );
  assert.throws(
    () => loadConfig({ OTA_ASSET_LIMIT_MB: '0' }),
    /OTA_ASSET_LIMIT_MB/,
  );
});

// ------------------------------------------------- o certificado embutido

const CANONICAL_CERTIFICATE = fileURLToPath(
  new URL('../../config/ota/certificate.pem', import.meta.url),
);

const normalizePem = (pem: string) => pem.replace(/\r\n/g, '\n').trim();

test('the embedded certificate is the canonical config/ota/certificate.pem', t => {
  if (!existsSync(CANONICAL_CERTIFICATE)) {
    t.skip('config/ota/certificate.pem does not exist yet: nothing to compare');
    return;
  }
  assert.ok(
    OTA_CODE_SIGNING_CERTIFICATE,
    'config/ota/certificate.pem exists: embed it in server/src/adapters/outbound/ota/certificate.ts',
  );
  assert.equal(
    normalizePem(OTA_CODE_SIGNING_CERTIFICATE),
    normalizePem(readFileSync(CANONICAL_CERTIFICATE, 'utf8')),
    'server/src/adapters/outbound/ota/certificate.ts differs from config/ota/certificate.pem: copy it (and its SHA-256)',
  );
});

test('the embedded certificate is RSA, pinned by its fingerprint, and its noUpdateAvailable signature verifies', t => {
  const certificate = otaCodeSigningCertificate();
  if (!certificate) {
    t.skip('no embedded certificate: OTA publishing is off');
    return;
  }
  assert.equal(certificate.publicKey.asymmetricKeyType, 'rsa');
  assert.ok(
    Date.parse(certificate.validTo) > Date.now(),
    'the certificate expired',
  );
  assert.throws(
    () => otaCodeSigningCertificate(keys.certificate),
    /certificate was changed/,
  );
  const verifier = createOtaSignatureVerifier(certificate);
  assert.equal(
    verifier.verify('texto', signText(keys.privateKey, 'texto')),
    false,
  );
  if (OTA_NO_UPDATE_AVAILABLE_SIGNATURE === null) {
    t.diagnostic(
      'no pre-made noUpdateAvailable signature: "no update" is a 204 until it is embedded',
    );
    return;
  }
  assert.equal(
    verifier.verify(
      NO_UPDATE_AVAILABLE_DIRECTIVE,
      OTA_NO_UPDATE_AVAILABLE_SIGNATURE,
    ),
    true,
  );
});

test('the verifier takes the certificate and checks RSA-SHA256 over the UTF-8 bytes', () => {
  const verifier = createOtaSignatureVerifier(
    new X509Certificate(keys.certificate),
  );
  const text = '{"extra":{"nome":"Avaliação"}}';
  assert.equal(verifier.verify(text, signText(keys.privateKey, text)), true);
  assert.equal(
    verifier.verify(`${text} `, signText(keys.privateKey, text)),
    false,
  );
  assert.equal(
    verifier.verify(text, signText(strangerKeys.privateKey, text)),
    false,
  );
  assert.equal(verifier.verify(text, 'AAAA'), false);
});
