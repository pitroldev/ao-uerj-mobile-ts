/*
 * Se o JavaScript de um commit roda no nativo de uma build da loja de outro
 * runtime (docs/ota.md, "OTA para uma build de outro runtime"). O runtime
 * muda com qualquer mudança nativa, mas o JS só depende da parte que ele vê:
 *
 *   - os métodos dos módulos nativos do app (src/specs): um método que sumiu
 *     ou mudou de assinatura quebra; um novo só vale se o JS conferir que ele
 *     existe antes de chamar (`typeof modulo.metodo === 'function'`); um
 *     módulo novo, só com TurboModuleRegistry.get (que dá null sem ele);
 *   - as dependências com código nativo (nova ou de outra versão) e o
 *     codegenConfig do package.json;
 *   - o certificado das atualizações (outro certificado, outra chave) e o
 *     app.json, fora a versão.
 *
 * O resto do nativo (android/, ios/, os patches de dependências, o manifesto,
 * ícones) muda a build, não o que o JS chama.
 *
 *   node scripts/ci/ota-compat.cjs <tag da build> [commit]
 *     Lista os problemas; sai com 1 se houver algum.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CERTIFICATE = 'config/ota/certificate.pem';
const SPECS = 'src/specs/';

/**
 * Caminhos que não entram no bundle do app: um push só com eles não muda o
 * que um OTA levaria.
 */
const OUTSIDE_BUNDLE = [
  /^server\//,
  /^deploy\//,
  /^docs\//,
  /^\.github\//,
  /^\.maestro\//,
  /^android\//,
  /^ios\//,
  /^scripts\//,
  /\.md$/,
  /(^|\/)__tests__\//,
  /\.test\.[cm]?[jt]sx?$/,
];

function gitAt(cwd) {
  const run = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return {
    changed: (from, to) =>
      run('diff', '--name-only', `${from}`, `${to}`)
        .split('\n')
        .filter(Boolean),
    show: (ref, file) => {
      try {
        return run('show', `${ref}:${file}`);
      } catch {
        return null;
      }
    },
    files: (ref, dir) =>
      run('ls-tree', '-r', '--name-only', ref, '--', dir)
        .split('\n')
        .filter(Boolean),
    grep: (ref, pattern, paths) => {
      try {
        return run('grep', '-l', '-E', pattern, ref, '--', ...paths)
          .split('\n')
          .filter(Boolean)
          .map(line => line.slice(line.indexOf(':') + 1));
      } catch {
        return [];
      }
    },
  };
}

/** Uma dependência com código nativo, pelo que está instalado agora. */
function nativePackageAt(root) {
  return name => {
    const dir = path.join(root, 'node_modules', name);
    if (!fs.existsSync(dir)) return true; // sem saber, conta como nativa
    return (
      ['android', 'ios'].some(sub => fs.existsSync(path.join(dir, sub))) ||
      fs.existsSync(path.join(dir, 'expo-module.config.json')) ||
      fs.readdirSync(dir).some(file => file.endsWith('.podspec'))
    );
  };
}

const parseJson = text => {
  try {
    return text == null ? null : JSON.parse(text);
  } catch {
    return null;
  }
};

/** Os métodos da interface Spec, com a assinatura normalizada. */
function specMethods(source) {
  const methods = new Map();
  if (!source) return methods;
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const start = code.search(/interface\s+Spec\s+extends\s+TurboModule\s*\{/);
  if (start === -1) return methods;
  let depth = 0;
  let body = '';
  for (let index = code.indexOf('{', start); index < code.length; index += 1) {
    const char = code[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) break;
    if (depth >= 1) body += char;
  }
  body = body.slice(1).replace(/\s+/g, ' ');
  // só o primeiro nível: os tipos dos parâmetros podem ter chaves
  let level = 0;
  let flat = '';
  for (const char of body) {
    if (char === '{') level += 1;
    if (level === 0) flat += char;
    else if (char === '}' && level === 1) flat += '{…}';
    if (char === '}') level -= 1;
  }
  for (const match of flat.matchAll(
    // o ; do fim fica para o começo do próximo (lookahead)
    /(?:^|;)\s*(?:readonly\s+)?(\w+)(\??)\s*\(([^)]*)\)\s*:\s*([^;]+)(?=;)/g,
  ))
    methods.set(
      match[1],
      `${match[2]}(${match[3].trim()}): ${match[4].trim()}`,
    );
  return methods;
}

/**
 * Os problemas para levar o JS de `to` à build feita de `from`; vazio se ele
 * roda lá.
 */
function compatibilityProblems({ from, to, git, nativePackage }) {
  const problems = [];
  const changed = git.changed(from, to);

  if (changed.includes(CERTIFICATE))
    problems.push(
      `O certificado das atualizações mudou (${CERTIFICATE}): a build da ${from} recusa a assinatura nova.`,
    );

  if (changed.includes('app.json')) {
    const strip = json => {
      if (!json) return json;
      const copy = structuredClone(json);
      delete copy.version;
      if (copy.expo) delete copy.expo.version;
      return JSON.stringify(copy);
    };
    if (
      strip(parseJson(git.show(from, 'app.json'))) !==
      strip(parseJson(git.show(to, 'app.json')))
    )
      problems.push('O app.json mudou além da versão.');
  }

  if (changed.includes('package.json')) {
    const before = parseJson(git.show(from, 'package.json')) ?? {};
    const after = parseJson(git.show(to, 'package.json')) ?? {};
    if (
      JSON.stringify(before.codegenConfig) !==
      JSON.stringify(after.codegenConfig)
    )
      problems.push('O codegenConfig do package.json mudou.');
    const old = before.dependencies ?? {};
    for (const [name, version] of Object.entries(after.dependencies ?? {}))
      if (old[name] !== version && nativePackage(name))
        problems.push(
          old[name]
            ? `A dependência nativa ${name} mudou (${old[name]} → ${version}).`
            : `A dependência nativa ${name} é nova.`,
        );
  }

  const specFiles = new Set(
    changed.filter(file => file.startsWith(SPECS) && /\.tsx?$/.test(file)),
  );
  for (const file of specFiles) {
    const next = git.show(to, file);
    if (next == null) continue; // o módulo saiu: o JS não o chama mais
    const previous = git.show(from, file);
    const module = path.basename(file).replace(/\.tsx?$/, '');
    if (previous == null) {
      if (/TurboModuleRegistry\.getEnforcing\b/.test(next))
        problems.push(
          `O módulo nativo ${module} é novo e é lido com getEnforcing: use TurboModuleRegistry.get, que dá null sem ele.`,
        );
      continue;
    }
    const before = specMethods(previous);
    const after = specMethods(next);
    for (const [name, signature] of after) {
      const old = before.get(name);
      if (old === undefined) {
        // ERE do git grep: sem \s nem \w, só as classes POSIX
        const guard = `typeof[[:space:]]+[A-Za-z_$][A-Za-z0-9_$.?]*\\.${name}[[:space:]]*===[[:space:]]*['"]function['"]`;
        const guarded = git
          .grep(to, guard, ['src'])
          .some(
            found => !found.startsWith(SPECS) && !/__tests__\//.test(found),
          );
        if (!guarded)
          problems.push(
            `${module}.${name} é novo no nativo, e o JS não confere se ele existe (typeof ….${name} === 'function') antes de chamar.`,
          );
      } else if (old !== signature)
        problems.push(
          `${module}.${name} mudou de assinatura: ${old} → ${signature}.`,
        );
    }
  }
  return problems;
}

/** Se algo que entra no bundle mudou entre os dois commits. */
function bundleChanged({ from, to, git }) {
  return git
    .changed(from, to)
    .some(file => !OUTSIDE_BUNDLE.some(pattern => pattern.test(file)));
}

if (require.main === module) {
  const [from, to = 'HEAD'] = process.argv.slice(2);
  if (!from) {
    console.error('Uso: ota-compat.cjs <tag da build> [commit]');
    process.exitCode = 2;
  } else {
    const problems = compatibilityProblems({
      from,
      to,
      git: gitAt(ROOT),
      nativePackage: nativePackageAt(ROOT),
    });
    for (const problem of problems) console.log(`- ${problem}`);
    console.log(
      problems.length
        ? `O JS de ${to} não roda na build da ${from}.`
        : `O JS de ${to} roda na build da ${from}.`,
    );
    if (problems.length) process.exitCode = 1;
  }
}

module.exports = {
  bundleChanged,
  compatibilityProblems,
  gitAt,
  nativePackageAt,
  specMethods,
};
