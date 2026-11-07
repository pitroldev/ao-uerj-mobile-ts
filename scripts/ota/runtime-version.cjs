#!/usr/bin/env node
/**
 * O runtime version que um build deste código embute, numa plataforma:
 *
 *   node scripts/ota/runtime-version.cjs <android|ios>
 *
 * Só o valor sai na saída padrão (o publicador das atualizações OTA o lê); o
 * resto vai para a saída de erro. É a impressão digital do lado nativo
 * (política fingerprint do app.json, fontes em fingerprint.config.js),
 * calculada pelo mesmo script do expo-updates que o build roda: o Gradle
 * (expo-updates-gradle-plugin) e o Xcode (create-updates-resources-ios.sh)
 * gravam no app o arquivo `fingerprint` que ele escreve. Como no build,
 * EXPO_UPDATES_FINGERPRINT_OVERRIDE, quando definido, vale no lugar do hash.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const PLATFORMS = ['android', 'ios'];

/** O script de build do expo-updates instalado no projeto. */
function updatesResourcesScript(root) {
  const manifest = require.resolve('expo-updates/package.json', {
    paths: [root],
  });
  return path.join(
    path.dirname(manifest),
    'utils',
    'build',
    'createUpdatesResources.js',
  );
}

/**
 * Roda o passo do build que grava o `fingerprint` (o modo only-fingerprint,
 * sem o manifesto das imagens, que não muda o valor) numa pasta temporária e
 * devolve o que ele gravou.
 */
function runtimeVersion(platform, { root = ROOT, env = process.env } = {}) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(
      `Plataforma desconhecida: ${platform} (use android ou ios).`,
    );
  }
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ota-runtime-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        updatesResourcesScript(root),
        platform,
        root,
        output,
        'only-fingerprint',
        'index.js',
        // o release: o build de debug não usa as atualizações
        'production',
      ],
      { cwd: root, env, encoding: 'utf8', windowsHide: true },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `O cálculo do expo-updates falhou (saída ${result.status ?? result.signal}):\n${result.stderr || result.stdout}`,
      );
    }
    const fingerprint = path.join(output, 'fingerprint');
    if (!fs.existsSync(fingerprint)) {
      throw new Error(
        'O build não gravaria o runtime version: falta "runtimeVersion": { "policy": "fingerprint" } no app.json.',
      );
    }
    return fs.readFileSync(fingerprint, 'utf8').trim();
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    process.stdout.write(`${runtimeVersion(process.argv[2])}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { runtimeVersion };
