const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const ota = require('../ota/publish.cjs');

// Chaves descartáveis, geradas neste processo: nenhuma chave vai para o repositório.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const otherKey = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
}).privateKey;
const verify = (text, signature) =>
  crypto.verify(
    'sha256',
    Buffer.from(text, 'utf8'),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(signature, 'base64'),
  );
const pemLines = privatePem.split('\n').filter(line => line.length === 64);

const BASE = 'https://pitrol.dev';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[A-Za-z0-9_-]{43}$/;
const NOW = new Date('2026-11-06T12:00:00.000Z');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aouerj-ota-test-'));
after(() => fs.rmSync(workspace, { recursive: true, force: true }));

const write = (dir, relative, content) => {
  const file = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

/** Um `expo export` de mentira, no formato do metadata.json da CLI. */
function fakeExport(name, options = {}) {
  const { platforms = ['android'], windowsPaths = false, bundle } = options;
  const dir = path.join(workspace, name);
  const icon = Buffer.from('png compartilhado pelas plataformas');
  const font = Buffer.from('fonte');
  write(dir, `assets/${ota.md5(icon)}`, icon);
  write(dir, `assets/${ota.md5(font)}`, font);
  const fileMetadata = {};
  for (const platform of platforms) {
    const bundlePath = `_expo/static/js/${platform}/index-0123abcd.hbc`;
    write(dir, bundlePath, bundle ?? `bundle de ${platform}`);
    const slashes = text => (windowsPaths ? text.replaceAll('/', '\\') : text);
    fileMetadata[platform] = {
      bundle: slashes(bundlePath),
      assets: [
        { path: slashes(`assets/${ota.md5(icon)}`), ext: 'png' },
        { path: slashes(`assets/${ota.md5(font)}`), ext: 'ttf' },
      ],
    };
  }
  fs.writeFileSync(
    path.join(dir, 'metadata.json'),
    JSON.stringify({ version: 0, bundler: 'metro', fileMetadata }),
  );
  return dir;
}

const planFrom = (dir, platform = 'android') =>
  ota.planUpdate({
    platform,
    runtimeVersion: 'rv-1',
    metadata: JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'))),
    readFile: relative => fs.readFileSync(ota.exportFile(dir, relative)),
    baseUrl: BASE,
    id: '0b4c7f53-3a8e-4d7a-9c39-4d1e2b0f8a61',
    createdAt: NOW.toISOString(),
  });

/** Um fetch que grava as requisições e responde com `respond` (200 por padrão). */
function recordingFetch(respond = () => 200) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, ...init });
    const status = respond(url, init, calls.length);
    return { ok: status < 300, status, text: async () => `status ${status}` };
  };
  return { calls, fetch };
}

const quiet = { log: () => {}, warn: () => {}, sleep: async () => {} };
const deps = extra => ({
  ...quiet,
  root: workspace,
  env: { OTA_SIGNING_KEY: privatePem },
  now: () => NOW,
  runtimeVersion: platform => `rv-${platform}`,
  runExport: () => {
    throw new Error('o export não devia rodar');
  },
  fetch: () => {
    throw new Error('a rede não devia ser usada');
  },
  ...extra,
});

test('hashes are base64url SHA-256 without padding and keys are hex MD5', () => {
  // SHA-256("abc") em base64 é ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=
  assert.equal(
    ota.sha256(Buffer.from('abc')),
    'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0',
  );
  assert.equal(ota.md5(Buffer.from('abc')), '900150983cd24fb0d6963f7d28e17f72');
});

test('the manifest has the Expo Updates v1 shape, with assets served by the OTA route', () => {
  const dir = fakeExport('shape');
  const { manifest, files } = planFrom(dir);
  assert.deepEqual(Object.keys(manifest), [
    'id',
    'createdAt',
    'runtimeVersion',
    'launchAsset',
    'assets',
    'metadata',
    'extra',
  ]);
  assert.equal(manifest.runtimeVersion, 'rv-1');
  assert.equal(manifest.createdAt, '2026-11-06T12:00:00.000Z');
  assert.deepEqual(manifest.metadata, {});
  assert.deepEqual(manifest.extra, {});

  const bundle = fs.readFileSync(
    path.join(dir, '_expo/static/js/android/index-0123abcd.hbc'),
  );
  assert.deepEqual(manifest.launchAsset, {
    hash: ota.sha256(bundle),
    key: ota.md5(bundle),
    contentType: 'application/javascript',
    fileExtension: '.bundle',
    url: `${BASE}/aouerj/ota/assets/${ota.sha256(bundle)}`,
  });
  assert.deepEqual(
    manifest.assets.map(asset => [asset.contentType, asset.fileExtension]),
    [
      ['image/png', '.png'],
      ['font/ttf', '.ttf'],
    ],
  );
  for (const asset of [manifest.launchAsset, ...manifest.assets]) {
    assert.match(asset.hash, HASH);
    assert.match(asset.key, /^[0-9a-f]{32}$/);
    assert.equal(asset.url, `${BASE}/aouerj/ota/assets/${asset.hash}`);
    assert.deepEqual(Object.keys(asset), [
      'hash',
      'key',
      'contentType',
      'fileExtension',
      'url',
    ]);
  }
  // o export dá ao asset o nome do MD5 dele, que é a key
  assert.equal(
    manifest.assets[0].key,
    path.basename(files[1].path.replaceAll('\\', '/')),
  );
  assert.equal(files.length, 3);
});

test('the update is signed over the exact manifest string the server will serve', () => {
  const plan = planFrom(fakeExport('signature'));
  const request = ota.updateRequest(BASE, plan, privateKey);
  assert.equal(request.method, 'POST');
  assert.equal(request.url, `${BASE}/aouerj/ota/updates`);
  assert.deepEqual(request.headers, { 'content-type': 'application/json' });
  const body = JSON.parse(request.body);
  assert.deepEqual(Object.keys(body), [
    'platform',
    'runtimeVersion',
    'manifest',
    'signature',
  ]);
  assert.equal(body.platform, 'android');
  assert.equal(body.runtimeVersion, 'rv-1');
  assert.equal(typeof body.manifest, 'string');
  assert.deepEqual(JSON.parse(body.manifest), plan.manifest);
  assert.ok(verify(body.manifest, body.signature));
  // o mesmo conteúdo com outros bytes não vale: a assinatura é sobre o texto
  assert.equal(
    verify(JSON.stringify(plan.manifest, null, 2), body.signature),
    false,
  );
  assert.equal(
    verify(body.manifest, ota.signRsaSha256(body.manifest, otherKey)),
    false,
  );
});

test('assets go up raw, with the content type and a signature over the ASCII hash', () => {
  const plan = planFrom(fakeExport('asset'));
  for (const file of plan.files) {
    const request = ota.assetRequest(BASE, file, privateKey);
    assert.equal(request.method, 'PUT');
    assert.equal(request.url, `${BASE}/aouerj/ota/assets/${file.hash}`);
    assert.equal(request.body, file.bytes);
    assert.equal(request.headers['content-type'], file.contentType);
    assert.ok(verify(file.hash, request.headers['expo-ota-signature']));
    assert.deepEqual(Object.keys(request.headers).sort(), [
      'content-type',
      'expo-ota-signature',
    ]);
  }
});

test('the rollback directive is rollBackToEmbedded with the commit time, signed as text', () => {
  const request = ota.directiveRequest(
    BASE,
    {
      platform: 'ios',
      runtimeVersion: 'rv-ios',
      directive: ota.rollbackDirective(NOW.toISOString()),
    },
    privateKey,
  );
  assert.equal(request.url, `${BASE}/aouerj/ota/directives`);
  const body = JSON.parse(request.body);
  assert.deepEqual(Object.keys(body), [
    'platform',
    'runtimeVersion',
    'directive',
    'signature',
  ]);
  assert.equal(
    body.directive,
    '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-11-06T12:00:00.000Z"}}',
  );
  assert.ok(verify(body.directive, body.signature));
});

test('export paths written on Windows resolve, and nothing escapes the export folder', () => {
  const dir = fakeExport('windows', { windowsPaths: true });
  const { manifest } = planFrom(dir);
  assert.equal(manifest.assets.length, 2);
  assert.equal(
    ota.exportFile(dir, 'assets\\abc'),
    path.join(dir, 'assets', 'abc'),
  );
  for (const bad of [
    '../segredo',
    'assets/../../x',
    '/etc/passwd',
    'C:\\x',
    '',
  ])
    assert.throws(() => ota.exportFile(dir, bad));
});

test('an unknown metadata.json format is refused instead of published', () => {
  const files = { bundle: 'b.hbc', assets: [] };
  assert.throws(
    () =>
      ota.readExportMetadata(
        { version: 1, fileMetadata: { android: files } },
        'android',
      ),
    /versão 1/,
  );
  assert.throws(
    () =>
      ota.readExportMetadata(
        { version: 0, fileMetadata: { android: files } },
        'ios',
      ),
    /bundle de ios/,
  );
  assert.throws(
    () =>
      ota.readExportMetadata(
        { version: 0, fileMetadata: { android: { bundle: 'b.hbc' } } },
        'android',
      ),
    /assets/,
  );
  assert.deepEqual(
    ota.readExportMetadata(
      {
        version: 0,
        fileMetadata: {
          android: {
            bundle: 'b.hbc',
            assets: [{ path: 'assets/a', ext: '.png' }],
          },
        },
      },
      'android',
    ).assets,
    [{ path: 'assets/a', ext: 'png' }],
  );
  // sem extensão, o Android pularia o asset e o servidor recusaria o manifest
  assert.throws(
    () =>
      ota.readExportMetadata(
        {
          version: 0,
          fileMetadata: {
            android: { bundle: 'b.hbc', assets: [{ path: 'assets/b' }] },
          },
        },
        'android',
      ),
    /assets\/b de android não tem extensão/,
  );
  assert.equal(ota.contentTypeFor('PNG'), 'image/png');
  assert.equal(ota.contentTypeFor('xyz'), 'application/octet-stream');
});

test('the server address is https, or plain http only on localhost for QA', () => {
  assert.equal(ota.normalizeBaseUrl('https://pitrol.dev/'), BASE);
  assert.equal(
    ota.normalizeBaseUrl('http://localhost:8787'),
    'http://localhost:8787',
  );
  assert.equal(
    ota.normalizeBaseUrl('http://127.0.0.1:8787/'),
    'http://127.0.0.1:8787',
  );
  for (const bad of [
    'http://pitrol.dev',
    'http://10.0.2.2:8787',
    'https://pitrol.dev/?x=1',
    'https://user:pass@pitrol.dev',
    'ftp://pitrol.dev',
    'pitrol.dev',
  ])
    assert.throws(() => ota.normalizeBaseUrl(bad), bad);
});

test('arguments: platforms, scoped runtime versions, inline values and mistakes', () => {
  assert.deepEqual(
    ota.parseArgs([
      '--platform=both',
      '--runtime-version=android=a1',
      '--runtime-version',
      'ios=i1',
      '--message=--fix: a nota some',
      '--dry-run',
    ]),
    {
      platforms: ['android', 'ios'],
      rollback: false,
      dryRun: true,
      runtimeVersions: { android: 'a1', ios: 'i1' },
      message: '--fix: a nota some',
    },
  );
  assert.deepEqual(
    ota.parseArgs([
      '--platform',
      'ios',
      '--rollback',
      '--runtime-version',
      'r9',
    ]).runtimeVersions,
    { '*': 'r9' },
  );
  assert.throws(() => ota.parseArgs(['--platform', 'web']), /web/);
  assert.throws(() => ota.parseArgs(['--plataform', 'ios']), /desconhecida/);
  assert.throws(() => ota.parseArgs(['--out-dir', '--dry-run']), /valor/);
  assert.throws(() => ota.parseArgs(['--rollback=yes']), /não leva valor/);
  assert.throws(
    () =>
      ota.parseArgs(['--platform', 'ios', '--rollback', '--export-dir', 'd']),
    /rollback/,
  );
});

test('runtime versions are one line of visible ASCII', () => {
  assert.equal(ota.validateRuntimeVersion('2.15.2'), '2.15.2');
  assert.equal(
    ota.validateRuntimeVersion('a4f1c0d9e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3'),
    'a4f1c0d9e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3',
  );
  for (const bad of ['', 'a b', 'a\nb', 'x'.repeat(256), 'ção', undefined])
    assert.throws(() => ota.validateRuntimeVersion(bad));
});

test('a dry run writes the signed manifests and every request, without the network', async () => {
  const dir = fakeExport('dry', { platforms: ['android', 'ios'] });
  const out = path.join(workspace, 'dry-out');
  const logs = [];
  const options = ota.parseArgs([
    '--platform=both',
    '--dry-run',
    `--export-dir=${dir}`,
    `--out-dir=${out}`,
    '--runtime-version=android=rv-android',
    '--runtime-version=ios=rv-ios',
  ]);
  const result = await ota.publish(
    options,
    deps({
      log: message => logs.push(message),
      warn: message => logs.push(message),
    }),
  );
  assert.equal(result.dryRun, true);
  assert.deepEqual(
    result.updates.map(update => [
      update.platform,
      update.runtimeVersion,
      update.assets,
    ]),
    [
      ['android', 'rv-android', 2],
      ['ios', 'rv-ios', 2],
    ],
  );
  for (const platform of ['android', 'ios']) {
    const manifest = fs.readFileSync(
      path.join(out, platform, 'manifest.json'),
      'utf8',
    );
    const signature = fs.readFileSync(
      path.join(out, platform, 'manifest.sig'),
      'utf8',
    );
    assert.ok(verify(manifest, signature), platform);
    const parsed = JSON.parse(manifest);
    assert.match(parsed.id, UUID);
    assert.equal(parsed.createdAt, NOW.toISOString());
    assert.equal(parsed.runtimeVersion, `rv-${platform}`);
  }
  const requests = JSON.parse(
    fs.readFileSync(path.join(out, 'requests.json'), 'utf8'),
  );
  // dois bundles e os dois assets que as plataformas dividem, cada um uma vez
  assert.deepEqual(
    requests.map(request => request.method),
    ['PUT', 'PUT', 'PUT', 'PUT', 'POST', 'POST'],
  );
  const puts = requests.filter(request => request.method === 'PUT');
  assert.equal(new Set(puts.map(request => request.url)).size, 4);
  for (const request of puts)
    assert.ok(fs.existsSync(request.bodyFile), request.bodyFile);
  const ids = requests
    .filter(request => request.method === 'POST')
    .map(request => JSON.parse(JSON.parse(request.body).manifest).id);
  assert.notEqual(ids[0], ids[1]);
  // nada da chave na pasta nem no log
  for (const file of fs.readdirSync(out, { recursive: true })) {
    const full = path.join(out, file);
    if (fs.statSync(full).isFile()) {
      const content = fs.readFileSync(full, 'utf8');
      assert.ok(!content.includes('PRIVATE KEY'), file);
      for (const line of pemLines) assert.ok(!content.includes(line), file);
    }
  }
  for (const line of pemLines) assert.ok(!logs.join('\n').includes(line));
});

test('a dry run without a key signs with a throwaway one and says so', async () => {
  const out = path.join(workspace, 'dry-ephemeral');
  const warnings = [];
  await ota.publish(
    ota.parseArgs([
      '--platform=android',
      '--dry-run',
      `--export-dir=${fakeExport('ephemeral')}`,
      `--out-dir=${out}`,
    ]),
    deps({ env: {}, warn: message => warnings.push(message) }),
  );
  assert.match(warnings.join('\n'), /descartável/);
  const ephemeral = fs.readFileSync(path.join(out, 'ephemeral-public-key.pem'));
  const manifest = fs.readFileSync(path.join(out, 'android', 'manifest.json'));
  const signature = fs.readFileSync(
    path.join(out, 'android', 'manifest.sig'),
    'utf8',
  );
  assert.ok(
    crypto.verify(
      'sha256',
      manifest,
      ephemeral,
      Buffer.from(signature, 'base64'),
    ),
  );
  assert.equal(verify(manifest.toString('utf8'), signature), false);
  // sem --dry-run, a falta da chave é um erro
  await assert.rejects(
    ota.publish(ota.parseArgs(['--platform=android']), deps({ env: {} })),
    /OTA_SIGNING_KEY/,
  );
});

test('a publish sends every asset before the manifests, each asset once', async () => {
  const { calls, fetch } = recordingFetch();
  const result = await ota.publish(
    ota.parseArgs([
      '--platform=both',
      `--export-dir=${fakeExport('send', { platforms: ['android', 'ios'] })}`,
    ]),
    deps({ fetch }),
  );
  assert.equal(result.dryRun, false);
  const methods = calls.map(call => call.method);
  assert.deepEqual(methods, ['PUT', 'PUT', 'PUT', 'PUT', 'POST', 'POST']);
  assert.equal(new Set(calls.slice(0, 4).map(call => call.url)).size, 4);
  for (const call of calls.slice(0, 4)) {
    const hash = call.url.split('/').pop();
    assert.equal(ota.sha256(call.body), hash);
    assert.ok(verify(hash, call.headers['expo-ota-signature']));
  }
  const manifests = calls.slice(4).map(call => JSON.parse(call.body));
  assert.deepEqual(
    manifests.map(body => [body.platform, body.runtimeVersion]),
    [
      ['android', 'rv-android'],
      ['ios', 'rv-ios'],
    ],
  );
  // todo asset que um manifest cita já foi enviado
  const sent = new Set(calls.slice(0, 4).map(call => call.url));
  for (const body of manifests) {
    const manifest = JSON.parse(body.manifest);
    for (const asset of [manifest.launchAsset, ...manifest.assets])
      assert.ok(sent.has(asset.url), asset.url);
    assert.ok(verify(body.manifest, body.signature));
  }
});

test('a refused asset stops the publish before any manifest, with the status in the message', async () => {
  const { calls, fetch } = recordingFetch((url, init) =>
    init.method === 'PUT' ? 403 : 200,
  );
  await assert.rejects(
    ota.publish(
      ota.parseArgs([
        '--platform=android',
        `--export-dir=${fakeExport('refused')}`,
      ]),
      deps({ fetch }),
    ),
    /PUT https:\/\/pitrol\.dev\/aouerj\/ota\/assets\/\S+ respondeu 403: status 403/,
  );
  assert.ok(calls.every(call => call.method === 'PUT'));
});

test('a 5xx on an asset is retried, a 5xx on the manifest is not', async () => {
  const retried = recordingFetch((url, init, count) =>
    init.method === 'PUT' && count === 1 ? 503 : 200,
  );
  await ota.publish(
    ota.parseArgs([
      '--platform=android',
      `--export-dir=${fakeExport('retry')}`,
    ]),
    deps({ fetch: retried.fetch }),
  );
  assert.equal(retried.calls.filter(call => call.method === 'PUT').length, 4);

  const failing = recordingFetch((url, init) =>
    init.method === 'POST' ? 502 : 200,
  );
  await assert.rejects(
    ota.publish(
      ota.parseArgs([
        '--platform=android',
        `--export-dir=${fakeExport('no-retry')}`,
      ]),
      deps({ fetch: failing.fetch }),
    ),
    /respondeu 502/,
  );
  assert.equal(failing.calls.filter(call => call.method === 'POST').length, 1);
});

test('code from another runtime is refused before exporting or sending anything', async () => {
  await assert.rejects(
    ota.publish(
      ota.parseArgs([
        '--platform=android',
        '--runtime-version=android=rv-store',
      ]),
      deps({ runtimeVersion: () => 'rv-main' }),
    ),
    /runtime rv-main em android, não do rv-store: o nativo mudou/,
  );
});

test('a rollback signs a directive for the given runtime, without exporting or computing it', async () => {
  const { calls, fetch } = recordingFetch();
  await ota.publish(
    ota.parseArgs([
      '--platform=android',
      '--rollback',
      '--runtime-version=rv-store',
    ]),
    deps({
      fetch,
      runtimeVersion: () => {
        throw new Error('o runtime não devia ser calculado');
      },
    }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${BASE}/aouerj/ota/directives`);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.runtimeVersion, 'rv-store');
  assert.deepEqual(JSON.parse(body.directive), {
    type: 'rollBackToEmbedded',
    parameters: { commitTime: NOW.toISOString() },
  });
  assert.ok(verify(body.directive, body.signature));
});

test('the signing key stays out of child processes and of anything uploaded', async () => {
  const env = ota.childEnv({ OTA_SIGNING_KEY: privatePem, PATH: '/bin' });
  assert.equal('OTA_SIGNING_KEY' in env, false);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.EXPO_NO_TELEMETRY, '1');

  // um bundle com a chave dentro (um plugin que embutiu o ambiente) não sai
  for (const format of ['pkcs8', 'pkcs1']) {
    const leaked = fakeExport(`leak-${format}`, {
      bundle: `var k = ${JSON.stringify(privateKey.export({ type: format, format: 'pem' }))};`,
    });
    const { calls, fetch } = recordingFetch();
    await assert.rejects(
      ota.publish(
        ota.parseArgs(['--platform=android', `--export-dir=${leaked}`]),
        deps({ fetch }),
      ),
      /contém a chave de assinatura/,
    );
    assert.equal(calls.length, 0);
  }
});

test('the key is read from PEM, also pasted on one line, and must be RSA of 2048 bits or more', () => {
  const oneLine = privatePem.trim().split('\n').join('\\n');
  assert.equal(ota.parsePrivateKey(oneLine).asymmetricKeyType, 'rsa');
  const ec = crypto
    .generateKeyPairSync('ec', { namedCurve: 'P-256' })
    .privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => ota.parsePrivateKey(ec), /RSA/);
  const small = crypto
    .generateKeyPairSync('rsa', { modulusLength: 1024 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => ota.parsePrivateKey(small), /2048/);
  const broken = privatePem.replace(pemLines[0], 'A'.repeat(64));
  assert.throws(
    () => ota.parsePrivateKey(broken),
    error => !error.message.includes(pemLines[1]) && /PEM/.test(error.message),
  );
});

function openssl(...args) {
  try {
    execFileSync('openssl', args, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

test('the key must be the one of the certificate the app embeds', async t => {
  const keyFile = path.join(workspace, 'cert-key.pem');
  const certificate = path.join(workspace, 'certificate.pem');
  fs.writeFileSync(keyFile, privatePem);
  if (
    !openssl(
      'req',
      '-x509',
      '-new',
      '-key',
      keyFile,
      '-out',
      certificate,
      '-days',
      '1',
      '-subj',
      '/CN=AO UERJ OTA test',
    )
  ) {
    t.skip('sem openssl para gerar o certificado');
    return;
  }
  const pem = fs.readFileSync(certificate, 'utf8');
  ota.assertKeyMatchesCertificate(privateKey, pem, 'teste');
  assert.throws(
    () => ota.assertKeyMatchesCertificate(otherKey, pem, 'teste'),
    /não é a do certificado teste/,
  );
  assert.throws(
    () => ota.assertKeyMatchesCertificate(privateKey, 'não é PEM', 'teste'),
    /teste não é um certificado/,
  );

  // o certificado do repositório (config/ota/) é conferido antes de qualquer envio
  const root = path.join(workspace, 'app-with-certificate');
  write(root, ota.CERTIFICATE, pem);
  const options = ota.parseArgs([
    '--platform=android',
    '--rollback',
    '--runtime-version=r1',
  ]);
  const { calls, fetch } = recordingFetch();
  const warnings = [];
  await ota.publish(
    options,
    deps({ root, fetch, warn: message => warnings.push(message) }),
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(warnings, []);
  await assert.rejects(
    ota.publish(
      options,
      deps({
        root,
        fetch,
        env: {
          OTA_SIGNING_KEY: otherKey.export({ type: 'pkcs8', format: 'pem' }),
        },
      }),
    ),
    /config[\\/]ota[\\/]certificate\.pem: os aparelhos recusariam/,
  );
  assert.equal(calls.length, 1);
  // --certificate troca o do repositório
  await assert.rejects(
    ota.publish(
      { ...options, certificate: path.join(workspace, 'nenhum.pem') },
      deps({ root, fetch }),
    ),
    /Não deu para ler o certificado .*nenhum\.pem/,
  );
});
