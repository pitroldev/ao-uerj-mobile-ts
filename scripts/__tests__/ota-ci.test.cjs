const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  checkOta,
  githubClient,
  latestStoreRelease,
  previousPush,
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
        created_at: '2026-11-20T12:00:00Z',
      },
    ],
    pushes: overrides.pushes ?? [],
    tip: overrides.tip ?? 'abc',
    releases: overrides.releases ?? [release('v2.15.2', ['android'])],
    stored: overrides.stored ?? { 'v2.15.2-android': 'rv-1\n' },
    current: overrides.current ?? { android: 'rv-1', ios: 'rv-ios' },
    compat: overrides.compat ?? (() => []),
    bundleChanged: overrides.bundleChanged ?? (() => true),
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
          if (resource.startsWith('actions/workflows/quality.yml/runs?branch'))
            return { workflow_runs: options.pushes };
          if (resource === 'branches/main')
            return { commit: { sha: options.tip } };
          if (resource.startsWith('releases')) return options.releases;
          throw new Error(`recurso inesperado: ${resource}`);
        },
        download: async asset => options.stored[asset.url.split('/').pop()],
        runtimeVersion: platform => {
          calls.push(`runtime ${platform}`);
          return options.current[platform];
        },
        compat: tag => {
          calls.push(`compat ${tag}`);
          return options.compat(tag);
        },
        bundleChanged: options.bundleChanged,
      }),
  };
}

const target = (runtimes, tags, extra = {}) => ({
  runtimes,
  other: false,
  tags,
  skipped: [],
  ...extra,
});

test('an update for the store runtime passes and says which runtime to target', async () => {
  const one = scenario();
  assert.deepEqual(await one.run(), {
    android: target(['rv-1'], ['v2.15.2']),
  });
  // o mesmo nativo não passa pela conferência do JS
  assert.ok(!one.calls.some(call => call.startsWith('compat')));
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

test('a bump does not block an update: it reaches every store build with this runtime', async () => {
  // a 2.16.0 trocou o nativo; a 2.16.1 e a 2.16.2 só o JS, como a main agora
  const releases = [
    release('v2.15.2', ['android']),
    release('v2.16.2', ['android']),
    release('v2.16.0', ['android']),
    release('v2.16.1', ['android']),
  ];
  const stored = {
    'v2.15.2-android': 'rv-1',
    'v2.16.0-android': 'rv-2',
    'v2.16.1-android': 'rv-2',
    'v2.16.2-android': 'rv-2',
  };
  const bumped = scenario({
    releases,
    stored,
    current: { android: 'rv-2' },
    compat: tag => (tag === 'v2.15.2' ? ['spec mudou'] : []),
  });
  assert.deepEqual(await bumped.run(), {
    android: target(['rv-2'], ['v2.16.2', 'v2.16.1', 'v2.16.0'], {
      skipped: [
        { runtime: 'rv-1', tags: ['v2.15.2'], problems: ['spec mudou'] },
      ],
    }),
  });
});

test('the JS also goes to a store build of another runtime when it runs on that native code', async () => {
  // a main tem nativo novo (rv-3), ainda fora da loja; o JS roda nas duas
  const releases = [
    release('v2.15.2', ['android']),
    release('v2.16.0', ['android']),
    release('v2.14.0', ['android']),
    release('v2.13.0', ['android']),
  ];
  const stored = {
    'v2.13.0-android': 'rv-0',
    'v2.14.0-android': 'rv-00',
    'v2.15.2-android': 'rv-1',
    'v2.16.0-android': 'rv-2',
  };
  const other = scenario({ releases, stored, current: { android: 'rv-3' } });
  const result = await other.run();
  // as três mais novas (RUNTIME_WINDOW), conferidas uma a uma
  assert.deepEqual(result.android.runtimes, ['rv-2', 'rv-1', 'rv-00']);
  assert.equal(result.android.other, true);
  assert.deepEqual(
    other.calls.filter(call => call.startsWith('compat')),
    ['compat v2.16.0', 'compat v2.15.2', 'compat v2.14.0'],
  );
  // uma build com o mesmo JS não recebe nada
  const same = await scenario({
    releases,
    stored,
    current: { android: 'rv-3' },
    bundleChanged: from => from !== 'v2.16.0',
  }).run();
  assert.deepEqual(same.android.runtimes, ['rv-1', 'rv-00']);
  assert.match(same.android.skipped[0].problems[0], /mesmo da v2\.16\.0/);
});

test('changed native code the JS calls is refused: it needs a store release', async () => {
  await assert.rejects(
    scenario({
      current: { android: 'rv-2' },
      compat: () => ['NativeX.y é novo no nativo'],
    }).run(),
    /Nenhuma build da loja recebe este JS\. android v2\.15\.2: NativeX\.y é novo no nativo.*release na loja/,
  );
});

test('an automatic run (after the Quality of a push) skips quietly instead of failing', async () => {
  const auto = { AUTO: 'true', OTA_SHA: 'abc', GITHUB_SHA: 'zzz' };
  // um push mais novo já está na main: o OTA dele vem depois
  assert.match(
    (await scenario({ env: auto, tip: 'def' }).run()).skip,
    /A main já está em def/,
  );
  // o push só mexeu no que não entra no app
  const pushes = [
    {
      head_sha: 'abc',
      head_branch: 'main',
      event: 'push',
      created_at: '2026-11-20T12:00:00Z',
    },
    {
      head_sha: 'old',
      head_branch: 'main',
      event: 'push',
      created_at: '2026-11-20T11:00:00Z',
    },
  ];
  const quiet = await scenario({
    env: auto,
    pushes,
    bundleChanged: from => from !== 'old',
  }).run();
  assert.match(quiet.skip, /desde old: sem OTA/);
  // sem build compatível: avisa, sem erro
  const refused = await scenario({
    env: auto,
    pushes,
    current: { android: 'rv-2' },
    compat: () => ['spec mudou'],
  }).run();
  assert.match(refused.skip, /Nenhuma build da loja recebe este JS/);
  // sem build do iPhone na loja: só o Android
  const both = await scenario({
    env: { ...auto, PLATFORM: 'both' },
    pushes,
  }).run();
  assert.deepEqual(Object.keys(both), ['android']);
});

test('the previous push is the last Quality of a push to main before this commit', () => {
  const run = (head_sha, created_at, extra = {}) => ({
    head_sha,
    created_at,
    head_branch: 'main',
    event: 'push',
    ...extra,
  });
  assert.equal(
    previousPush(
      [
        run('new', '2026-11-20T13:00:00Z'),
        run('abc', '2026-11-20T12:00:00Z'),
        run('pr', '2026-11-20T11:30:00Z', { event: 'pull_request' }),
        run('old', '2026-11-20T11:00:00Z'),
        run('older', '2026-11-20T10:00:00Z'),
      ],
      'abc',
    ),
    'old',
  );
  assert.equal(previousPush([], 'abc'), undefined);
});

test('a rollback targets the store runtime without the Quality gate or this code runtime', async () => {
  const rollback = scenario({
    env: { ROLLBACK: 'true' },
    runs: [],
    current: {},
  });
  assert.deepEqual(await rollback.run(), {
    android: target(['rv-1'], ['v2.15.2']),
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

test('ota.yml runs by hand and, on its own, after the Quality of a push to main', () => {
  const triggers = ota.split(/^on:\n/m)[1].split(/^\S/m)[0];
  assert.deepEqual(
    [...triggers.matchAll(/^ {2}(\w+):/gm)].map(match => match[1]),
    ['workflow_dispatch', 'workflow_run'],
  );
  assert.match(
    triggers,
    /platform:\n(?: {8}.*\n)*? {8}type: choice\n {8}options: \[android, ios, both\]/,
  );
  assert.match(triggers, /message:\n(?: {8}.*\n)*? {8}required: true/);
  assert.match(triggers, /rollback:\n(?: {8}.*\n)*? {8}type: boolean/);
  assert.match(
    triggers,
    /workflow_run:\n {4}workflows: \[Quality\]\n {4}types: \[completed\]\n {4}branches: \[main\]/,
  );
  // o automático só depois de um Quality verde de push
  assert.match(
    otaJobs.check,
    /github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.event == 'push'/,
  );
  assert.match(
    otaJobs.check,
    /AUTO: \$\{\{ github\.event_name == 'workflow_run' \}\}/,
  );
  assert.match(ota, /^permissions: \{\}$/m);
});

test('ota.yml checks first and publishes only from main, in the play environment', () => {
  assert.deepEqual(Object.keys(otaJobs), ['check', 'publish']);
  const { check, publish } = otaJobs;
  assert.match(check, /run: node scripts\/ci\/ota-check\.cjs\n/);
  assert.doesNotMatch(check, /environment:|secrets\./);
  assert.match(publish, /^ {4}needs: check$/m);
  assert.match(
    publish,
    /^ {4}if: github\.ref == 'refs\/heads\/main' && needs\.check\.outputs\.platform != ''$/m,
  );
  // outro runtime só com a conferência do check
  assert.match(
    publish,
    /\[ "\$OTHER" != true \] \|\| set -- "\$@" --other-runtime/,
  );
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
  const checkouts = ota.split(/- uses: actions\/checkout@/).slice(1);
  assert.equal(checkouts.length, 2);
  for (const checkout of checkouts)
    assert.match(checkout.split(/\n {6}- /)[0], /persist-credentials: false/);
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
  assert.match(record, /^ {4}needs: \[prepare, play, github-release\]$/m);
  assert.match(record, /needs\.play\.result == 'success'/);
  assert.match(record, /^ {6}contents: write$/m);
  assert.doesNotMatch(record, /secrets\.|environment:|actions\/checkout/);
  assert.ok(record.includes(runtimeAssetName('android')));
  assert.match(record, /gh release upload "\$TAG" "\$file" --clobber/);
});

test('every version tag on main goes to both stores, with the GitHub Release and both runtimes', () => {
  const workflow = read('.github/workflows/release.yml');
  const jobs = jobsOf(workflow);
  // a tag do bump feito à mão também publica, no mesmo run
  assert.match(
    jobs['version-tag'],
    /created: \$\{\{ steps\.create\.outputs\.created \}\}/,
  );
  assert.match(jobs.prepare, /needs\.version-tag\.outputs\.created == 'true'/);
  assert.match(jobs.prepare, /needs\.version-tag\.outputs\.tag/);
  // o GitHub Release sai das notas do CHANGELOG, se ainda não existe
  assert.match(
    jobs['github-release'],
    /node scripts\/ci\/release-notes\.cjs notes "\$TAG" "\$SHA" "\$notes"/,
  );
  // a App Store pela mesma tag, depois do Quality, com o runtime registrado
  assert.match(
    jobs['app-store'],
    /uses: \.\/\.github\/workflows\/ios-app-store\.yml/,
  );
  assert.match(jobs['app-store'], /^ {4}needs: \[prepare, quality\]$/m);
  assert.match(
    jobs['app-store'],
    /build_number: \$\{\{ needs\.prepare\.outputs\.build \}\}/,
  );
  const ios = jobs['runtime-version-ios'];
  assert.match(ios, /^ {4}needs: \[prepare, app-store, github-release\]$/m);
  assert.ok(ios.includes(runtimeAssetName('ios')));
  assert.doesNotMatch(ios, /secrets\.|environment:|actions\/checkout/);
  const appStore = read('.github/workflows/ios-app-store.yml');
  assert.match(appStore, /^ {2}workflow_call:$/m);
  assert.match(appStore, /ref: \$\{\{ inputs\.ref \|\| github\.sha \}\}/);
  assert.match(appStore, /echo "runtime=\$runtime" >> "\$GITHUB_OUTPUT"/);
});
