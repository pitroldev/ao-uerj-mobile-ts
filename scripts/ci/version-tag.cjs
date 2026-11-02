const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

/*
 * A tag do bump feito à mão. O release-please acha a versão do
 * .release-please-manifest.json pelo GitHub Release ou, sem ele, pela tag
 * vX.Y.Z. Um bump fora do PR dele ("chore: release X.Y.Z" direto na main) não
 * cria nenhum dos dois, e o release-please, sem achar a versão, volta ao
 * bootstrap-sha e propõe uma 2.0.0 com o histórico inteiro. O workflow Release
 * roda isto antes dele: acha o commit que pôs a versão atual no package.json e
 * diz se falta a tag. Nunca move uma tag existente.
 */

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function planVersionTag(cwd = process.cwd(), ref = 'HEAD') {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const versionAt = sha => {
    try {
      return JSON.parse(git('show', `${sha}:package.json`)).version;
    } catch {
      return undefined;
    }
  };

  const version = versionAt(ref);
  if (typeof version !== 'string' || !VERSION.test(version))
    throw new Error('O package.json não tem uma versão MAJOR.MINOR.PATCH.');

  // o commit mais antigo da sequência, a partir de `ref`, em que o
  // package.json já tem esta versão: o do bump (mudanças de dependências
  // depois dele não contam)
  let sha = null;
  for (const commit of git(
    'log',
    '--first-parent',
    '--format=%H',
    ref,
    '--',
    'package.json',
  ).split('\n')) {
    if (!commit || versionAt(commit) !== version) break;
    sha = commit;
  }
  if (!sha) throw new Error('Nenhum commit põe esta versão no package.json.');

  const tag = `v${version}`;
  let tagged = null;
  try {
    tagged = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
  } catch {
    // sem a tag
  }
  if (tagged && tagged !== sha)
    throw new Error(
      `A tag ${tag} já existe em ${tagged}, não no bump ${sha}; ela não é movida.`,
    );
  return { tag, sha, create: !tagged };
}

if (require.main === module) {
  try {
    const { tag, sha, create } = planVersionTag();
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tag=${tag}\nsha=${sha}\ncreate=${create}\n`,
    );
    console.log(create ? `Falta a tag ${tag} (${sha}).` : `${tag} já existe.`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { planVersionTag };
