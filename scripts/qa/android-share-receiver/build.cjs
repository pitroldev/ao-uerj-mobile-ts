const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const usage = `Compila o receptor Android local de PNG e PDF em uma pasta temporária.

Uso: node scripts/qa/android-share-receiver/build.cjs [--check]

Requisitos: JAVA_HOME com JDK 17, ANDROID_SDK_ROOT (ou ANDROID_HOME),
Android SDK Platform 36 e Build Tools 36.0.0. Não requer Gradle nem pnpm.
--check verifica somente os caminhos, sem compilar ou instalar.`;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(command)} terminou com código ${result.status}.`,
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(usage);
    return;
  }
  if (args.some(arg => arg !== '--check')) throw new Error(usage);
  const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  const jdk = process.env.JAVA_HOME;
  if (!sdk || !jdk) throw new Error(usage);
  const executable = process.platform === 'win32' ? '.exe' : '';
  const buildTools = path.join(sdk, 'build-tools', '36.0.0');
  const files = {
    javac: path.join(jdk, 'bin', `javac${executable}`),
    java: path.join(jdk, 'bin', `java${executable}`),
    jar: path.join(jdk, 'bin', `jar${executable}`),
    keytool: path.join(jdk, 'bin', `keytool${executable}`),
    aapt2: path.join(buildTools, `aapt2${executable}`),
    zipalign: path.join(buildTools, `zipalign${executable}`),
    d8: path.join(buildTools, 'lib', 'd8.jar'),
    apksigner: path.join(buildTools, 'lib', 'apksigner.jar'),
    lambdaStubs: path.join(buildTools, 'core-lambda-stubs.jar'),
    android: path.join(sdk, 'platforms', 'android-36', 'android.jar'),
  };
  for (const file of Object.values(files)) {
    if (!fs.existsSync(file)) throw new Error(`Requisito ausente: ${file}`);
  }
  if (args.includes('--check')) {
    console.log(
      'JDK e ferramentas do Android encontrados. Nenhum build executado.',
    );
    return;
  }

  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-file-share-probe-'));
  const classes = path.join(output, 'classes');
  const dex = path.join(output, 'dex');
  fs.mkdirSync(classes);
  fs.mkdirSync(dex);
  const classJar = path.join(output, 'classes.jar');
  const unsigned = path.join(output, 'unsigned.apk');
  const aligned = path.join(output, 'aligned.apk');
  const keystore = path.join(output, 'local-probe.keystore');
  const apk = path.join(output, 'ao-file-share-probe.apk');
  console.log(`Artefatos temporários: ${output}`);
  run(files.javac, [
    '-encoding',
    'UTF-8',
    '-source',
    '8',
    '-target',
    '8',
    '-bootclasspath',
    [files.lambdaStubs, files.android].join(path.delimiter),
    '-d',
    classes,
    path.join(
      __dirname,
      'src',
      'dev',
      'aouerj',
      'shareprobe',
      'ShareReceiverActivity.java',
    ),
  ]);
  run(files.jar, ['--create', '--file', classJar, '-C', classes, '.']);
  run(files.java, [
    '-cp',
    files.d8,
    'com.android.tools.r8.D8',
    '--lib',
    files.android,
    '--min-api',
    '24',
    '--output',
    dex,
    classJar,
  ]);
  run(files.aapt2, [
    'link',
    '--manifest',
    path.join(__dirname, 'AndroidManifest.xml'),
    '-I',
    files.android,
    '-o',
    unsigned,
    '--min-sdk-version',
    '24',
    '--target-sdk-version',
    '36',
  ]);
  run(files.jar, ['--update', '--file', unsigned, '-C', dex, 'classes.dex']);
  run(files.zipalign, ['-f', '-p', '4', unsigned, aligned]);
  run(files.keytool, [
    '-genkeypair',
    '-noprompt',
    '-keystore',
    keystore,
    '-storepass',
    'android',
    '-alias',
    'local-probe',
    '-keypass',
    'android',
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '30',
    '-dname',
    'CN=Local Share Probe',
  ]);
  run(files.java, [
    '-jar',
    files.apksigner,
    'sign',
    '--ks',
    keystore,
    '--ks-pass',
    'pass:android',
    '--key-pass',
    'pass:android',
    '--out',
    apk,
    aligned,
  ]);
  run(files.java, ['-jar', files.apksigner, 'verify', '--verbose', apk]);
  console.log(`APK: ${apk}`);
  console.log('Pacote: dev.aouerj.shareprobe — seletor: AO Arquivo local');
  console.log('A instalação é manual. Cada build gera uma chave local nova.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
