/*
 * As notas da GitHub Release de uma versão e o número da build do iPhone,
 * lidos do commit da tag (não da árvore de trabalho).
 *
 *   node scripts/ci/release-notes.cjs notes <vX.Y.Z> <commit> <arquivo>
 *     Grava a seção da versão do CHANGELOG.md, mais as linhas "Android:
 *     versão vX.Y.Z, código N." e "iPhone: versão X.Y.Z, build B.", como nas
 *     releases feitas à mão.
 *
 *   node scripts/ci/release-notes.cjs build <commit>
 *     Grava build=<CURRENT_PROJECT_VERSION do iOS> no GITHUB_OUTPUT.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const XCODE_PROJECT = 'ios/AOUerjMobile.xcodeproj/project.pbxproj';

const show = (sha, file, cwd) =>
  execFileSync('git', ['show', `${sha}:${file}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/** O CURRENT_PROJECT_VERSION do projeto do Xcode (o mesmo em Debug e Release). */
function iosBuild(pbxproj) {
  const builds = new Set(
    [...pbxproj.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(
      match => match[1],
    ),
  );
  if (builds.size !== 1)
    throw new Error(
      `O ${XCODE_PROJECT} devia ter um CURRENT_PROJECT_VERSION só, e tem ${builds.size}.`,
    );
  return Number([...builds][0]);
}

/** O código da versão no Android (MAJOR·10⁷ + MINOR·10⁴ + PATCH). */
const versionCode = ([major, minor, patch]) =>
  major * 10_000_000 + minor * 10_000 + patch;

/** A seção "## X.Y.Z (data)" do CHANGELOG, sem o título. */
function changelogSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line =>
    new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}\\]?\\b`).test(line),
  );
  if (start === -1)
    throw new Error(`O CHANGELOG.md não tem a seção da ${version}.`);
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith('## '),
  );
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

function releaseNotes({ tag, changelog, pbxproj }) {
  const match = TAG.exec(tag);
  if (!match) throw new Error(`Tag inválida: ${tag} (use vX.Y.Z).`);
  const parts = match.slice(1).map(Number);
  const version = parts.join('.');
  return [
    changelogSection(changelog, version),
    '',
    `Android: versão ${tag}, código ${versionCode(parts)}.`,
    `iPhone: versão ${version}, build ${iosBuild(pbxproj)}.`,
    '',
  ].join('\n');
}

if (require.main === module) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === 'notes' && args.length === 3) {
      const [tag, sha, file] = args;
      fs.writeFileSync(
        file,
        releaseNotes({
          tag,
          changelog: show(sha, 'CHANGELOG.md'),
          pbxproj: show(sha, XCODE_PROJECT),
        }),
      );
    } else if (mode === 'build' && args.length === 1) {
      const build = iosBuild(show(args[0], XCODE_PROJECT));
      if (process.env.GITHUB_OUTPUT)
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `build=${build}\n`);
      console.log(`Build do iPhone: ${build}`);
    } else {
      throw new Error(
        'Uso: release-notes.cjs notes <vX.Y.Z> <commit> <arquivo> | build <commit>',
      );
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { changelogSection, iosBuild, releaseNotes, versionCode };
