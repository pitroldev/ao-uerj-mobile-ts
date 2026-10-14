const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

function resolveRelease(tag, cwd = process.cwd()) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '')) {
    throw new Error('Informe uma tag existente no formato vMAJOR.MINOR.PATCH.');
  }
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  let sha;
  try {
    sha = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
    git('merge-base', '--is-ancestor', sha, 'origin/main');
  } catch {
    throw new Error('A tag deve existir e apontar para um commit da main.');
  }
  const { version } = JSON.parse(git('show', `${sha}:package.json`));
  if (tag !== `v${version}`) {
    throw new Error(
      'A tag não corresponde à versão do package.json desse commit.',
    );
  }
  return { tag, sha };
}

if (require.main === module) {
  try {
    const { tag, sha } = resolveRelease(process.env.RELEASE_TAG);
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nsha=${sha}\n`);
    console.log(`Release ${tag}: ${sha}`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { resolveRelease };
