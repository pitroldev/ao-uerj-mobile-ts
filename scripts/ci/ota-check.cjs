/*
 * As conferências do OTA (docs/ota.md), feitas antes de o run pedir a
 * aprovação do environment `play`.
 *
 *   node scripts/ci/ota-check.cjs
 *     No ota.yml, com PLATFORM (android, ios ou both), ROLLBACK (true ou
 *     false), AUTO (true no run automático, depois do Quality de um push),
 *     OTA_SHA (o commit; sem ele, GITHUB_SHA), GITHUB_TOKEN e as variáveis do
 *     Actions. Exige o run na main e, num update, o Quality verde neste
 *     commit. As builds na loja são os GitHub Releases com o asset
 *     runtime-version-<plataforma>.txt, que o release.yml grava quando a loja
 *     recebe a build. Num update, o JS vai para os runtimes das builds mais
 *     novas: o do mesmo nativo direto, e um de outro nativo só se o JS rodar
 *     nele (ota-compat.cjs). Grava android=<runtimes>, ios=<runtimes>,
 *     other, platform e sha no GITHUB_OUTPUT; a volta (rollback) usa o
 *     runtime da build mais nova da loja direto.
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
const {
  bundleChanged: bundleChangedBetween,
  compatibilityProblems,
  gitAt,
  nativePackageAt,
} = require('./ota-compat.cjs');

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
 * Quantos runtimes de cada plataforma recebem o update: o da build mais nova
 * da loja e os anteriores, que ainda estão nos aparelhos de quem não
 * atualizou (a Play e a App Store liberam aos poucos, e a revisão demora).
 */
const RUNTIME_WINDOW = 3;

/** As builds da loja agrupadas pelo runtime, da mais nova para a mais velha. */
function groupByRuntime(builds, runtimes) {
  const groups = [];
  builds.forEach((build, index) => {
    const runtime = runtimes[index];
    const group = groups.find(candidate => candidate.runtime === runtime);
    if (group) group.tags.push(build.tag);
    else groups.push({ runtime, tags: [build.tag] });
  });
  return groups;
}

/** O commit da main do push anterior (o último Quality de push antes deste). */
function previousPush(runs, sha) {
  const own = runs.find(run => run.head_sha === sha);
  return runs
    .filter(
      run =>
        run.event === 'push' &&
        run.head_branch === 'main' &&
        run.head_sha !== sha &&
        (!own || run.created_at < own.created_at),
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.head_sha;
}

/**
 * As conferências; `api`, `download`, `runtimeVersion`, `compat` e
 * `bundleChanged` são trocados nos testes.
 *
 * Num update, o JS deste commit vai para os runtimes das builds da loja (os
 * RUNTIME_WINDOW mais novos): direto para o do mesmo nativo e, para um
 * runtime de outro nativo, só se o JS rodar nele (`compat(tag)` sem
 * problemas, scripts/ci/ota-compat.cjs). Num automático (AUTO=true, depois do
 * Quality de um push), nada sai se o commit não for mais o da ponta da main
 * ou se o push não mexeu no que entra no bundle.
 *
 * Devolve { [plataforma]: { runtimes, other, tags, skipped } } e, quando nada
 * sai, `{ skip: motivo }`. Na volta, `runtimes` é só o da build mais nova.
 */
async function checkOta({
  env,
  api,
  download,
  runtimeVersion,
  compat = () => [],
  bundleChanged = () => true,
}) {
  if (env.GITHUB_REF !== 'refs/heads/main')
    throw new Error(
      `O OTA só sai da main, e este run é de ${env.GITHUB_REF}: escolha main em "Use workflow from".`,
    );
  const platforms = platformsOf(env.PLATFORM);
  const rollback = env.ROLLBACK === 'true';
  const auto = env.AUTO === 'true';
  const sha = env.OTA_SHA || env.GITHUB_SHA;
  if (!rollback) {
    const { workflow_runs: runs = [] } = await api(
      `actions/workflows/quality.yml/runs?head_sha=${sha}&per_page=100`,
    );
    const state = qualityState(runs, sha);
    if (state !== 'success') throw new Error(QUALITY_PROBLEMS[state]);
  }
  if (auto) {
    const tip = (await api('branches/main'))?.commit?.sha;
    if (tip && tip !== sha)
      return {
        skip: `A main já está em ${tip}: o OTA sai depois do Quality desse commit.`,
      };
    const { workflow_runs: pushes = [] } = await api(
      'actions/workflows/quality.yml/runs?branch=main&event=push&per_page=30',
    );
    const previous = previousPush(pushes, sha);
    if (previous && !bundleChanged(previous, sha))
      return {
        skip: `Nada do que entra no app mudou desde ${previous}: sem OTA.`,
      };
  }
  const releases = await api('releases?per_page=100');
  const result = {};
  for (const platform of platforms) {
    const builds = storeReleases(releases, platform);
    if (!builds.length) {
      if (auto) continue;
      throw new Error(
        `Nenhum GitHub Release registra uma build de ${platform} na loja (${runtimeAssetName(platform)}): sem build na loja, o OTA não tem para quem ir.`,
      );
    }
    const runtimeOf = async build =>
      validateRuntimeVersion(
        (await download(build.asset)).trim(),
        `O ${runtimeAssetName(platform)} da ${build.tag}`,
      );
    if (rollback) {
      const [latest] = builds;
      result[platform] = {
        runtimes: [await runtimeOf(latest)],
        other: false,
        tags: [latest.tag],
        skipped: [],
      };
      continue;
    }
    const current = runtimeVersion(platform);
    const runtimes = [];
    for (const build of builds) runtimes.push(await runtimeOf(build));
    const entry = { runtimes: [], other: false, tags: [], skipped: [] };
    for (const group of groupByRuntime(builds, runtimes).slice(
      0,
      RUNTIME_WINDOW,
    )) {
      const [newest] = group.tags;
      if (!bundleChanged(newest, sha)) {
        entry.skipped.push({
          ...group,
          problems: [`O JS é o mesmo da ${newest}.`],
        });
        continue;
      }
      // o mesmo nativo: o bump não barra
      const problems = group.runtime === current ? [] : compat(newest);
      if (problems.length) {
        entry.skipped.push({ ...group, problems });
        continue;
      }
      entry.runtimes.push(group.runtime);
      entry.tags.push(...group.tags);
      if (group.runtime !== current) entry.other = true;
    }
    if (entry.runtimes.length || entry.skipped.length) result[platform] = entry;
  }
  const targets = Object.values(result).flatMap(entry => entry.runtimes);
  if (!targets.length) {
    const reasons = Object.entries(result).flatMap(([platform, entry]) =>
      entry.skipped.map(
        group =>
          `${platform} ${group.tags.join(', ')}: ${group.problems.join(' ')}`,
      ),
    );
    const message = `Nenhuma build da loja recebe este JS.${reasons.length ? ` ${reasons.join(' | ')}` : ''}`;
    if (auto) return { ...result, skip: message };
    throw new Error(
      `${message} Se o nativo mudou o que o JS chama, isso pede uma release na loja (docs/ota.md).`,
    );
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
  const sha = env.OTA_SHA || env.GITHUB_SHA;
  const git = gitAt(ROOT);
  const result = await checkOta({
    env,
    ...githubClient(env),
    runtimeVersion: platform => currentRuntimeVersion(platform, ROOT, env),
    compat: tag =>
      compatibilityProblems({
        from: tag,
        to: sha,
        git,
        nativePackage: nativePackageAt(ROOT),
      }),
    bundleChanged: (from, to = sha) => bundleChangedBetween({ from, to, git }),
  });
  const { skip, ...platforms } = result;
  const going = PLATFORMS.filter(
    platform => platforms[platform]?.runtimes.length,
  );
  output([
    ...PLATFORMS.map(
      platform =>
        `${platform}=${platforms[platform]?.runtimes.join(',') ?? ''}`,
    ),
    `other=${Object.values(platforms).some(entry => entry.other)}`,
    `platform=${going.length === 2 ? 'both' : (going[0] ?? '')}`,
    `sha=${sha}`,
  ]);
  const summary = [];
  for (const [platform, entry] of Object.entries(platforms)) {
    if (entry.runtimes.length)
      summary.push(
        `${platform}: vai para ${entry.runtimes.join(', ')} (builds ${entry.tags.join(', ')}).`,
      );
    for (const group of entry.skipped)
      summary.push(
        `${platform}: fica de fora ${group.runtime} (${group.tags.join(', ')}): ${group.problems.join(' ')}`,
      );
  }
  if (skip) summary.push(skip);
  for (const line of summary) console.log(line);
  if (env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### OTA: para onde vai\n\n${summary.map(line => `- ${line}`).join('\n')}\n`,
    );
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`::error::${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  RUNTIME_WINDOW,
  checkOta,
  githubClient,
  latestStoreRelease,
  previousPush,
  qualityState,
  runtimeAssetName,
};
