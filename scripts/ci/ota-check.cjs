/*
 * As conferências do OTA (docs/ota.md), feitas antes de o run pedir a
 * aprovação do environment `play`.
 *
 *   node scripts/ci/ota-check.cjs
 *     No ota.yml, com PLATFORM (android, ios ou both), ROLLBACK (true ou
 *     false), GITHUB_TOKEN e as variáveis do Actions. Exige o run na main e,
 *     num update, o Quality verde neste commit. Acha a última build de cada
 *     plataforma na loja: o GitHub Release mais novo com o asset
 *     runtime-version-<plataforma>.txt, que o release.yml grava depois que a
 *     loja aceita a build. Num update, o package.json tem de estar na versão
 *     dessa release (um OTA não é bump) e o runtime deste código tem de ser o
 *     dela (o nativo não mudou). Grava android=<runtime> e ios=<runtime> no
 *     GITHUB_OUTPUT; a volta (rollback) usa o runtime da loja direto.
 *
 *   node scripts/ci/ota-check.cjs runtime <android|ios>
 *     No release.yml: o runtime da build que vai para a loja, validado, em
 *     runtime=<valor> no GITHUB_OUTPUT.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  PLATFORMS,
  currentRuntimeVersion,
  validateRuntimeVersion,
} = require('../ota/publish.cjs');

const ROOT = path.resolve(__dirname, '../..');
const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** O asset do GitHub Release com o runtime da build da loja. */
const runtimeAssetName = platform => `runtime-version-${platform}.txt`;

function compareTags(a, b) {
  const left = RELEASE_TAG.exec(a).slice(1).map(Number);
  const right = RELEASE_TAG.exec(b).slice(1).map(Number);
  for (let index = 0; index < 3; index += 1)
    if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

/** A release vX.Y.Z mais nova (pela versão) com o runtime da plataforma registrado. */
function latestStoreRelease(releases, platform) {
  const name = runtimeAssetName(platform);
  let latest;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (!RELEASE_TAG.test(release.tag_name ?? '')) continue;
    const asset = release.assets?.find(candidate => candidate.name === name);
    if (asset && (!latest || compareTags(release.tag_name, latest.tag) > 0))
      latest = { tag: release.tag_name, asset };
  }
  return latest;
}

/** O Quality deste commit na main: success, pending, failure ou missing. */
function qualityState(runs, sha) {
  const relevant = runs.filter(
    run =>
      run.head_sha === sha &&
      run.head_branch === 'main' &&
      (run.event === 'push' || run.event === 'workflow_dispatch'),
  );
  if (
    relevant.some(
      run => run.status === 'completed' && run.conclusion === 'success',
    )
  )
    return 'success';
  if (relevant.some(run => run.status !== 'completed')) return 'pending';
  return relevant.length ? 'failure' : 'missing';
}

const QUALITY_PROBLEMS = {
  pending:
    'O Quality ainda está rodando neste commit: espere ele terminar e rode o OTA de novo.',
  failure:
    'O Quality falhou neste commit: corrija ou rode de novo antes do OTA.',
  missing:
    'O Quality não rodou neste commit da main: rode o workflow Quality na main e depois o OTA.',
};

function platformsOf(value) {
  if (value === 'both') return [...PLATFORMS];
  if (PLATFORMS.includes(value)) return [value];
  throw new Error(`Plataforma desconhecida: ${value} (android, ios ou both).`);
}

/**
 * As conferências; `api`, `download`, `runtimeVersion` e `packageVersion`
 * são trocados nos testes. Devolve { [plataforma]: { runtime, tag } }.
 */
async function checkOta({
  env,
  api,
  download,
  runtimeVersion,
  packageVersion,
}) {
  if (env.GITHUB_REF !== 'refs/heads/main')
    throw new Error(
      `O OTA só sai da main, e este run é de ${env.GITHUB_REF}: escolha main em "Use workflow from".`,
    );
  const platforms = platformsOf(env.PLATFORM);
  const rollback = env.ROLLBACK === 'true';
  if (!rollback) {
    const sha = env.GITHUB_SHA;
    const { workflow_runs: runs = [] } = await api(
      `actions/workflows/quality.yml/runs?head_sha=${sha}&per_page=100`,
    );
    const state = qualityState(runs, sha);
    if (state !== 'success') throw new Error(QUALITY_PROBLEMS[state]);
  }
  const releases = await api('releases?per_page=100');
  const version = rollback ? undefined : packageVersion();
  const result = {};
  for (const platform of platforms) {
    const found = latestStoreRelease(releases, platform);
    if (!found)
      throw new Error(
        `Nenhum GitHub Release registra uma build de ${platform} na loja (${runtimeAssetName(platform)}): sem build na loja, o OTA não tem para quem ir.`,
      );
    const runtime = validateRuntimeVersion(
      (await download(found.asset)).trim(),
      `O ${runtimeAssetName(platform)} da ${found.tag}`,
    );
    if (!rollback) {
      if (found.tag !== `v${version}`)
        throw new Error(
          `A main está na versão ${version}, e a última build de ${platform} na loja é a ${found.tag}. Um OTA não muda a versão: uma versão nova é release na loja (docs/release.md).`,
        );
      const current = runtimeVersion(platform);
      if (current !== runtime)
        throw new Error(
          `O runtime de ${platform} mudou: ${current} neste commit, ${runtime} na ${found.tag}. O código nativo mudou, e isso pede uma release na loja, não um OTA.`,
        );
    }
    result[platform] = { runtime, tag: found.tag };
  }
  return result;
}

function githubClient(env, fetchImpl = globalThis.fetch) {
  const base = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}`;
  const get = async (url, accept) => {
    // na primeira chamada, depois da conferência da main
    if (!env.GITHUB_TOKEN) throw new Error('Falta o GITHUB_TOKEN.');
    const response = await fetchImpl(url, {
      headers: {
        accept,
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'user-agent': 'aouerj-ota-check',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok)
      throw new Error(
        `A API do GitHub respondeu ${response.status} em ${url.replace(base, '')}.`,
      );
    return response;
  };
  return {
    api: async resource =>
      (await get(`${base}/${resource}`, 'application/vnd.github+json')).json(),
    // o asset redireciona para um endereço assinado, sem o token
    download: async asset =>
      (await get(asset.url, 'application/octet-stream')).text(),
  };
}

async function main(argv, env = process.env) {
  const output = lines => {
    if (env.GITHUB_OUTPUT)
      fs.appendFileSync(
        env.GITHUB_OUTPUT,
        lines.map(line => `${line}\n`).join(''),
      );
  };
  if (argv[0] === 'runtime') {
    if (argv.length !== 2 || !PLATFORMS.includes(argv[1]))
      throw new Error('Uso: ota-check.cjs runtime <android|ios>');
    const runtime = currentRuntimeVersion(argv[1], ROOT, env);
    output([`runtime=${runtime}`]);
    console.log(`Runtime de ${argv[1]}: ${runtime}`);
    return;
  }
  if (argv.length)
    throw new Error('Uso: ota-check.cjs [runtime <android|ios>]');
  const result = await checkOta({
    env,
    ...githubClient(env),
    runtimeVersion: platform => currentRuntimeVersion(platform, ROOT, env),
    packageVersion: () =>
      JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
        .version,
  });
  output(
    PLATFORMS.map(platform => `${platform}=${result[platform]?.runtime ?? ''}`),
  );
  for (const [platform, { runtime, tag }] of Object.entries(result))
    console.log(`${platform}: runtime ${runtime}, o da ${tag} na loja.`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`::error::${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  checkOta,
  githubClient,
  latestStoreRelease,
  qualityState,
  runtimeAssetName,
};
