/*
 * As conferências do OTA (docs/ota.md), feitas antes de o run pedir a
 * aprovação do environment `play`.
 *
 *   node scripts/ci/ota-check.cjs
 *     No ota.yml, com PLATFORM (android, ios ou both), ROLLBACK (true ou
 *     false), GITHUB_TOKEN e as variáveis do Actions. Exige o run na main e,
 *     num update, o Quality verde neste commit. As builds na loja são os
 *     GitHub Releases com o asset runtime-version-<plataforma>.txt, que o
 *     release.yml grava depois que a loja aceita a build. Num update, o
 *     runtime deste código tem de ser o de alguma delas: só o nativo barra um
 *     OTA, não o bump (ele chega a todas as builds com o mesmo runtime). Grava
 *     android=<runtime> e ios=<runtime> no GITHUB_OUTPUT; a volta (rollback)
 *     usa o runtime da build mais nova da loja direto.
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

/**
 * As releases vX.Y.Z com o runtime da plataforma registrado (as builds na
 * loja), da versão mais nova para a mais velha.
 */
function storeReleases(releases, platform) {
  const name = runtimeAssetName(platform);
  return releases
    .filter(
      release =>
        !release.draft &&
        !release.prerelease &&
        RELEASE_TAG.test(release.tag_name ?? ''),
    )
    .map(release => ({
      tag: release.tag_name,
      asset: release.assets?.find(candidate => candidate.name === name),
    }))
    .filter(release => release.asset)
    .sort((a, b) => compareTags(b.tag, a.tag));
}

/** A release vX.Y.Z mais nova (pela versão) com o runtime da plataforma registrado. */
function latestStoreRelease(releases, platform) {
  return storeReleases(releases, platform)[0];
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
 * As conferências; `api`, `download` e `runtimeVersion` são trocados nos
 * testes. Devolve { [plataforma]: { runtime, tag, tags } }: `tag` é a build
 * mais nova que o update alcança, e `tags`, todas as da loja com o runtime
 * dele (na volta, só a mais nova).
 */
async function checkOta({ env, api, download, runtimeVersion }) {
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
  const result = {};
  for (const platform of platforms) {
    const builds = storeReleases(releases, platform);
    if (!builds.length)
      throw new Error(
        `Nenhum GitHub Release registra uma build de ${platform} na loja (${runtimeAssetName(platform)}): sem build na loja, o OTA não tem para quem ir.`,
      );
    const runtimeOf = async build =>
      validateRuntimeVersion(
        (await download(build.asset)).trim(),
        `O ${runtimeAssetName(platform)} da ${build.tag}`,
      );
    if (rollback) {
      const [latest] = builds;
      result[platform] = {
        runtime: await runtimeOf(latest),
        tag: latest.tag,
        tags: [latest.tag],
      };
      continue;
    }
    // o bump não barra: o update vai para toda build da loja com este runtime
    const current = runtimeVersion(platform);
    const runtimes = [];
    for (const build of builds) runtimes.push(await runtimeOf(build));
    const tags = builds
      .filter((_build, index) => runtimes[index] === current)
      .map(build => build.tag);
    if (!tags.length)
      throw new Error(
        `O runtime de ${platform} mudou: ${current} neste commit, ${runtimes[0]} na ${builds[0].tag}, e nenhuma build na loja tem o deste commit. O código nativo mudou, e isso pede uma release na loja, não um OTA.`,
      );
    result[platform] = { runtime: current, tag: tags[0], tags };
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
  });
  output(
    PLATFORMS.map(platform => `${platform}=${result[platform]?.runtime ?? ''}`),
  );
  for (const [platform, { runtime, tags }] of Object.entries(result))
    console.log(
      `${platform}: runtime ${runtime}, o das builds ${tags.join(', ')} na loja.`,
    );
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
