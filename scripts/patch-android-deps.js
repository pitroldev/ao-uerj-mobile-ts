const fs = require('node:fs');
const path = require('node:path');

const target =
  'node_modules/@react-native-cookies/cookies/android/build.gradle';

// cookies 6.2.1 still declares jcenter(), removed in Gradle 9. Keep this
// compatibility patch until upgrading the cookie adapter and its native tests.
function patchedCookiesGradle(source) {
  const result = source.replace(/\bjcenter\s*\(\s*\)/g, 'mavenCentral()');
  if (!/\bmavenCentral\s*\(\s*\)/.test(result)) {
    throw new Error(
      'Patch cookies: layout desconhecido; revise a dependência.',
    );
  }
  return result;
}

function patchAndroidDependencies({
  check = false,
  root = path.resolve(__dirname, '..'),
} = {}) {
  const filename = path.join(root, target);
  if (!fs.existsSync(filename)) {
    throw new Error(
      `Patch obrigatório ausente: ${target}. Instale as dependências completas.`,
    );
  }
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchedCookiesGradle(source);
  if (source !== patched) {
    if (check)
      throw new Error('Patch cookies pendente: execute pnpm postinstall.');
    fs.writeFileSync(filename, patched, 'utf8');
  }
  return source !== patched;
}

if (require.main === module) {
  try {
    const changed = patchAndroidDependencies({
      check: process.argv.includes('--check'),
    });
    console.log(
      `[patches] cookies Gradle: ${changed ? 'aplicado' : 'verificado'}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { patchedCookiesGradle, patchAndroidDependencies };
