const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  checkOta,
  githubClient,
  latestStoreRelease,
  qualityState,
  runtimeAssetName,
} = require('../ci/ota-check.cjs');

const root = path.resolve(__dirname, '../..');
const read = filename =>
  fs.readFileSync(path.join(root, filename), 'utf8').replace(/\r\n/g, '\n');

/** Os jobs de um workflow, cada um com o texto dele (sem parser de YAML). */
function jobsOf(workflow) {
  const jobs = {};
  let current;
  for (const line of workflow.split(/^jobs:\n/m)[1].split('\n')) {
    const header = /^ {2}([\w-]+):\s*$/.exec(line);
    if (header) {
      current = header[1];
      jobs[current] = '';
    } else if (current) jobs[current] += `${line}\n`;
  }
  return jobs;
}

/** Os scripts dos `run:`, de uma linha ou em bloco. */
function runScripts(text) {
  const lines = text.split('\n');
  const scripts = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)(- )?run: ?(.*)$/.exec(line);
    if (!match) return;
    if (!/^[|>][-+]?$/.test(match[3])) {
      scripts.push(match[3]);
      return;
    }
    const indent = match[1].length + (match[2] ? 2 : 0);
    const block = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() && next.search(/\S/) <= indent) break;
      block.push(next);
    }
    scripts.push(block.join('\n'));
  });
  return scripts;
}

const release = (tag, platforms = [], extra = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: platforms.map(platform => ({
    name: runtimeAssetName(platform),
    url: `https://api.github.com/assets/${tag}-${platform}`,
  })),
  ...extra,
});

test('the latest store build is the highest version with the runtime recorded', () => {
  const releases = [
    release('v2.16.0'), // no GitHub Release, mas a Play ainda não aceitou
    release('v2.15.2', ['android']),
    release('v2.15.10', ['android']),
    release('v3.0.0', ['android'], { draft: true }),
    release('v2.17.0-beta', ['android']),
    release('v2.18.0', ['android'], { prerelease: true }),
    release('nightly', ['android']),
  ];
  assert.equal(latestStoreRelease(releases, 'android').tag, 'v2.15.10');
  assert.equal(
    latestStoreRelease(releases, 'android').asset.name,
    'runtime-version-android.txt',
  );
  assert.equal(latestStoreRelease(releases, 'ios'), undefined);
});

test('the Quality gate needs a green push or manual run of this exact main commit', () => {
  const run = (extra = {}) => ({
    head_sha: 'abc',
    head_branch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    ...extra,
  });
  assert.equal(qualityState([run()], 'abc'), 'success');
  assert.equal(
    qualityState(
      [run({ conclusion: 'failure' }), run({ event: 'workflow_dispatch' })],
      'abc',
    ),
    'success',
  );
  assert.equal(
    qualityState([run({ status: 'in_progress', conclusion: null })], 'abc'),
    'pending',
  );
  assert.equal(
    qualityState([run({ conclusion: 'cancelled' })], 'abc'),
    'failure',
  );
  assert.equal(qualityState([run({ head_sha: 'def' })], 'abc'), 'missing');
  // um PR com o mesmo commit não vale pela main
  assert.equal(
    qualityState([run({ event: 'pull_request' })], 'abc'),
    'missing',
  );
  assert.equal(
    qualityState([run({ head_branch: 'feature' })], 'abc'),
    'missing',
  );
});

/** O ambiente de um run do ota.yml e uma API do GitHub de mentira. */
function scenario(overrides = {}) {
  const calls = [];
  const options = {
    env: {
      GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: 'abc',
      PLATFORM: 'android',
      ROLLBACK: 'false',
      ...overrides.env,
    },
    runs: overrides.runs ?? [
      {
        head_sha: 'abc',
        head_branch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
      },
    ],
    releases: overrides.releases ?? [release('v2.15.2', ['android'])],
    stored: overrides.stored ?? { 'v2.15.2-android': 'rv-1\n' },
    current: overrides.current ?? { android: 'rv-1', ios: 'rv-ios' },
    version: overrides.version ?? '2.15.2',
  };
  return {
    calls,
    run: () =>
      checkOta({
        env: options.env,
        api: async resource => {
          calls.push(resource);
          if (
            resource.startsWith(
              'actions/workflows/quality.yml/runs?head_sha=abc',
            )
          )
            return { workflow_runs: options.runs };
          if (resource.startsWith('releases')) return options.releases;
          throw new Error(`recurso inesperado: ${resource}`);
        },
        download: async asset => options.stored[asset.url.split('/').pop()],
        runtimeVersion: platform => {
          calls.push(`runtime ${platform}`);
          return options.current[platform];
        },
        packageVersion: () => options.version,
      }),
  };
}

test('an update for the store runtime and version passes and says which runtime to target', async () => {
  assert.deepEqual(await scenario().run(), {
    android: { runtime: 'rv-1', tag: 'v2.15.2' },
  });
  const both = scenario({
    env: { PLATFORM: 'both' },
    releases: [release('v2.15.2', ['android', 'ios'])],
    stored: { 'v2.15.2-android': 'rv-1', 'v2.15.2-ios': 'rv-ios' },
  });
  assert.deepEqual(Object.keys(await both.run()), ['android', 'ios']);
});

test('the OTA refuses other branches, a Quality that is not green and a missing store build', async () => {
  await assert.rejects(
    scenario({ env: { GITHUB_REF: 'refs/heads/feature' } }).run(),
    /só sai da main/,
  );
  await assert.rejects(
    scenario({
      runs: [
        {
          head_sha: 'abc',
          head_branch: 'main',
          event: 'push',
          status: 'queued',
        },
      ],
    }).run(),
    /ainda está rodando/,
  );
  await assert.rejects(scenario({ runs: [] }).run(), /não rodou neste commit/);
  // o iPhone ainda não tem build na loja
  await assert.rejects(
    scenario({ env: { PLATFORM: 'both' } }).run(),
    /build de ios na loja \(runtime-version-ios\.txt\)/,
  );
  await assert.rejects(
    scenario({ stored: { 'v2.15.2-android': 'a b' } }).run(),
    /não é válido/,
  );
});

test('an OTA is not a version bump: main must be at the version of the store build', async () => {
  const bumped = scenario({ version: '2.16.0' });
  await assert.rejects(
    bumped.run(),
    /versão 2\.16\.0.*v2\.15\.2.*não muda a versão/,
  );
  assert.ok(!bumped.calls.includes('runtime android'));
});

test('changed native code (another runtime) is refused: it needs a store release', async () => {
  await assert.rejects(
    scenario({ current: { android: 'rv-2' } }).run(),
    /rv-2 neste commit, rv-1 na v2\.15\.2.*release na loja/,
  );
});

test('a rollback targets the store runtime without the Quality gate or this code runtime', async () => {
  const rollback = scenario({
    env: { ROLLBACK: 'true' },
    runs: [],
    version: '9.9.9',
    current: {},
  });
  assert.deepEqual(await rollback.run(), {
    android: { runtime: 'rv-1', tag: 'v2.15.2' },
  });
  assert.deepEqual(rollback.calls, ['releases?per_page=100']);
});

test('the GitHub client reads the repository API with the run token and downloads assets raw', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return {
      ok: !url.endsWith('/missing'),
      status: 404,
      json: async () => [],
      text: async () => 'rv-1\n',
    };
  };
  const env = {
    GITHUB_REPOSITORY: 'pitroldev/ao-uerj-mobile-ts',
    GITHUB_TOKEN: 'token-de-teste',
  };
  const client = githubClient(env, fetch);
  await client.api('releases?per_page=100');
  assert.equal(
    await client.download({
      url: 'https://api.github.com/repos/x/releases/assets/7',
    }),
    'rv-1\n',
  );
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/pitroldev/ao-uerj-mobile-ts/releases?per_page=100',
  );
  assert.equal(calls[0].headers.accept, 'application/vnd.github+json');
  assert.equal(calls[1].headers.accept, 'application/octet-stream');
  for (const call of calls)
    assert.equal(call.headers.authorization, 'Bearer token-de-teste');
  await assert.rejects(client.api('missing'), /respondeu 404 em \/missing/);
  await assert.rejects(githubClient({}, fetch).api('releases'), /GITHUB_TOKEN/);
});

const ota = read('.github/workflows/ota.yml');
const otaJobs = jobsOf(ota);

test('ota.yml is manual only, with platform, message and rollback inputs', () => {
  const triggers = ota.split(/^on:\n/m)[1].split(/^\S/m)[0];
  assert.deepEqual(
    [...triggers.matchAll(/^ {2}(\w+):/gm)].map(match => match[1]),
    ['workflow_dispatch'],
  );
  assert.match(
    triggers,
    /platform:\n(?: {8}.*\n)*? {8}type: choice\n {8}options: \[android, ios, both\]/,
  );
  assert.match(triggers, /message:\n(?: {8}.*\n)*? {8}required: true/);
  assert.match(triggers, /rollback:\n(?: {8}.*\n)*? {8}type: boolean/);
  assert.match(ota, /^permissions: \{\}$/m);
});

test('ota.yml checks first and publishes only from main, in the play environment', () => {
  assert.deepEqual(Object.keys(otaJobs), ['check', 'publish']);
  const { check, publish } = otaJobs;
  assert.match(check, /run: node scripts\/ci\/ota-check\.cjs\n/);
  assert.doesNotMatch(check, /environment:|secrets\./);
  assert.match(publish, /^ {4}needs: check$/m);
  assert.match(publish, /^ {4}if: github\.ref == 'refs\/heads\/main'$/m);
  assert.match(publish, /^ {4}environment: play$/m);
  assert.match(publish, /^ {6}contents: read$/m);
  assert.doesNotMatch(publish, /contents: write/);
  assert.match(publish, /node scripts\/ota\/publish\.cjs "\$@"/);
  // o job com a chave não usa cache
  assert.doesNotMatch(publish, /cache: pnpm/);
  assert.match(publish, /package-manager-cache: false/);
});

test('ota.yml hands the signing key to the publisher only, and never echoes it', () => {
  assert.equal(ota.match(/secrets\./g).length, 1);
  assert.match(
    otaJobs.publish,
    /^ {10}OTA_SIGNING_KEY: \$\{\{ secrets\.OTA_SIGNING_KEY \}\}$/m,
  );
  for (const script of runScripts(ota)) {
    assert.doesNotMatch(script, /OTA_SIGNING_KEY/);
    assert.doesNotMatch(script, /set -x|printenv|\benv\b/);
    // as entradas (a mensagem é texto livre) chegam por env, nunca no script
    assert.doesNotMatch(script, /\$\{\{/);
  }
});

test('the publisher checks the key against the certificate the Android build embeds', () => {
  const { CERTIFICATE } = require('../ota/publish.cjs');
  assert.ok(
    read('android/app/build.gradle').includes(`"../${CERTIFICATE}"`),
    CERTIFICATE,
  );
  const { publicKey } = new crypto.X509Certificate(read(CERTIFICATE));
  assert.equal(publicKey.asymmetricKeyType, 'rsa');
  assert.ok(publicKey.asymmetricKeyDetails.modulusLength >= 2048);
});

test('the publisher strips the key from the export it runs', () => {
  const publisher = read('scripts/ota/publish.cjs');
  for (const call of publisher.match(
    /(?:spawnSync|execFileSync)\([\s\S]*?\);/g,
  ))
    assert.match(call, /env: childEnv\(env\)/);
});

test('every workflow action is pinned by SHA to the same commits the other workflows use', () => {
  const known = new Set(
    ['quality.yml', 'release.yml', 'server.yml', 'ios.yml', 'e2e.yml']
      .flatMap(name => [
        ...read(`.github/workflows/${name}`).matchAll(/uses: (\S+@\S+)/g),
      ])
      .map(match => match[1]),
  );
  const uses = [...ota.matchAll(/uses: (\S+)@(\S+)/g)];
  assert.ok(uses.length >= 5);
  for (const [, action, ref] of uses) {
    assert.match(ref, /^[0-9a-f]{40}$/, action);
    assert.ok(known.has(`${action}@${ref}`), `${action}@${ref}`);
  }
  // os dois checkouts, cada um sem deixar o token no .git
  const checkouts = ota.match(
    /actions\/checkout@\S+.*\n\s+with:\n\s+persist-credentials: \w+/g,
  );
  assert.equal(checkouts.length, 2);
  assert.equal(ota.match(/actions\/checkout@/g).length, 2);
  for (const checkout of checkouts)
    assert.match(checkout, /persist-credentials: false/);
});

test('release.yml records the runtime of the build the Play accepted, without widening the play job', () => {
  const jobs = jobsOf(read('.github/workflows/release.yml'));
  const { play } = jobs;
  const record = jobs['runtime-version'];
  assert.ok(record, 'runtime-version job');
  // o play continua só com leitura e sem falhar por causa do OTA
  assert.match(play, /^ {4}permissions:\n {6}contents: read\n {4}outputs:/m);
  assert.match(
    play,
    /runtime_version: \$\{\{ steps\.runtime\.outputs\.runtime \}\}/,
  );
  const step = play.match(/ {6}- id: runtime\n(?: {8}.*\n)+/)[0];
  assert.match(step, /continue-on-error: true/);
  assert.match(step, /run: node scripts\/ci\/ota-check\.cjs runtime android/);
  const order = [
    'pnpm install --frozen-lockfile',
    'id: runtime',
    'name: AAB assinado',
    'r0adkll/upload-google-play',
  ];
  const positions = order.map(marker => play.indexOf(marker));
  assert.ok(
    positions.every(position => position !== -1),
    positions.join(),
  );
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
  );
  // o registro só depois da Play, com escrita só nele, e sem segredos
  assert.match(record, /^ {4}needs: \[prepare, play\]$/m);
  assert.match(record, /needs\.play\.result == 'success'/);
  assert.match(record, /^ {6}contents: write$/m);
  assert.doesNotMatch(record, /secrets\.|environment:|actions\/checkout/);
  assert.ok(record.includes(runtimeAssetName('android')));
  assert.match(record, /gh release upload "\$TAG" "\$file" --clobber/);
});
