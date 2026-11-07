const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const script = path.join(root, 'scripts/ota/runtime-version.cjs');
const { runtimeVersion } = require('../ota/runtime-version.cjs');
const fingerprintConfig = require('../../fingerprint.config.js');

const UPDATE_URL = 'https://pitrol.dev/aouerj/ota/manifest';
const certificate = () => read('config/ota/certificate.pem').trim();

/** O valor do meta-data `name` no AndroidManifest.xml de src/main. */
function manifestValue(name) {
  const match = read('android/app/src/main/AndroidManifest.xml').match(
    new RegExp(
      `android:name="${name.replace(/\./g, '\\.')}"\\s+android:value="([^"]*)"`,
    ),
  );
  assert.ok(match, name);
  return match[1].replace(/&quot;/g, '"');
}

/** O valor depois de `<key>name</key>` no ios/AOUerjMobile/Expo.plist. */
function plistValue(name) {
  const match = read('ios/AOUerjMobile/Expo.plist').match(
    new RegExp(
      `<key>${name}</key>\\s*(<string>[\\s\\S]*?</string>|<integer>\\d+</integer>|<true />|<false />|<dict>[\\s\\S]*?</dict>)`,
    ),
  );
  assert.ok(match, name);
  return match[1];
}

/**
 * Os arquivos que entram no runtime version de cada plataforma, pela mesma
 * função do expo-updates que o build roda (workflow "generic": android/ e ios/
 * estão no Git).
 */
async function hashedFiles(platform) {
  const { createFingerprintAsync } = require(
    path.join(
      root,
      'node_modules/expo-updates/utils/build/createFingerprintAsync.js',
    ),
  );
  const fingerprint = await createFingerprintAsync(root, platform, 'generic', {
    debug: true,
    silent: true,
  });
  const files = [];
  const walk = info => {
    if (!info) return;
    if (info.children) info.children.forEach(walk);
    else if (info.path) files.push(info.path.replace(/\\/g, '/'));
  };
  for (const source of fingerprint.sources) walk(source.debugInfo);
  return { hash: fingerprint.hash, files };
}

test('the update URL, check policy and launch wait are the same contract on both platforms', () => {
  const gradle = read('android/app/build.gradle');
  assert.ok(gradle.includes(`def otaProductionUrl = "${UPDATE_URL}"`));
  assert.equal(
    manifestValue('expo.modules.updates.EXPO_UPDATE_URL'),
    '${otaUpdateUrl}',
  );
  assert.equal(
    manifestValue('expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH'),
    'ALWAYS',
  );
  assert.equal(
    manifestValue('expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS'),
    '0',
  );
  assert.equal(plistValue('EXUpdatesURL'), `<string>${UPDATE_URL}</string>`);
  assert.equal(plistValue('EXUpdatesCheckOnLaunch'), '<string>ALWAYS</string>');
  assert.equal(plistValue('EXUpdatesLaunchWaitMs'), '<integer>0</integer>');
});

test('updates are on only in the Android release (debug uses Metro)', () => {
  const gradle = read('android/app/build.gradle');
  assert.equal(manifestValue('expo.modules.updates.ENABLED'), '${otaEnabled}');
  assert.match(
    gradle,
    /defaultConfig \{[\s\S]*?manifestPlaceholders = \[otaEnabled: "false", otaUpdateUrl: otaUpdateUrl\]/,
  );
  assert.match(
    gradle,
    /release \{\s*[^}]*?manifestPlaceholders = \[otaEnabled: "true"\]/,
  );
  // no iPhone o expo-updates se desliga sozinho no Debug; o plist é o do release
  assert.equal(plistValue('EXUpdatesEnabled'), '<true />');
});

test('code signing embeds config/ota/certificate.pem with keyid main and rsa-v1_5-sha256', () => {
  const pem = certificate();
  assert.match(
    pem,
    /^-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+\n-----END CERTIFICATE-----$/,
  );
  assert.ok(!read('config/ota/certificate.pem').includes('\r'), 'LF only');
  // Android: o Gradle lê o próprio arquivo (sem cópia que se desatualize)
  const gradle = read('android/app/build.gradle');
  assert.ok(
    gradle.includes('rootProject.file("../config/ota/certificate.pem")'),
  );
  assert.ok(
    gradle.includes(
      'resValue "string", "ota_code_signing_certificate", otaCertificate.replace("\\n", "\\\\n")',
    ),
  );
  assert.equal(
    manifestValue('expo.modules.updates.CODE_SIGNING_CERTIFICATE'),
    '@string/ota_code_signing_certificate',
  );
  assert.deepEqual(
    JSON.parse(manifestValue('expo.modules.updates.CODE_SIGNING_METADATA')),
    { keyid: 'main', alg: 'rsa-v1_5-sha256' },
  );
  // iOS: a cópia no Expo.plist tem de ser o mesmo certificado
  assert.equal(
    plistValue('EXUpdatesCodeSigningCertificate'),
    `<string>${pem}</string>`,
  );
  const metadata = plistValue('EXUpdatesCodeSigningMetadata');
  assert.match(metadata, /<key>keyid<\/key>\s*<string>main<\/string>/);
  assert.match(metadata, /<key>alg<\/key>\s*<string>rsa-v1_5-sha256<\/string>/);
  // o projeto do Xcode põe no app o Expo.plist, que o expo-updates lê de lá
  const project = read('ios/AOUerjMobile.xcodeproj/project.pbxproj');
  const resources = project
    .split('/* Begin PBXResourcesBuildPhase section */')[1]
    .split('/* End PBXResourcesBuildPhase section */')[0];
  assert.match(resources, /Expo\.plist in Resources/);
  assert.match(project, /path = AOUerjMobile\/Expo\.plist;/);
});

test('both platforms embed the fingerprint the build computes as the runtime version', () => {
  assert.deepEqual(JSON.parse(read('app.json')).runtimeVersion, {
    policy: 'fingerprint',
  });
  assert.equal(
    manifestValue('expo.modules.updates.EXPO_RUNTIME_VERSION'),
    'file:fingerprint',
  );
  assert.equal(
    plistValue('EXUpdatesRuntimeVersion'),
    '<string>file:fingerprint</string>',
  );
  // a tarefa que grava o fingerprint não declara os arquivos do hash: sem
  // rodar sempre, um build incremental embutiria o valor antigo
  assert.match(
    read('android/app/build.gradle'),
    /tasks\.matching \{ it\.name ==~ \/create\\w\+UpdatesResources\/ \}\.configureEach \{\s*outputs\.upToDateWhen \{ false \}/,
  );
  // no iPhone o app abre o React Native (com ou sem janela) depois de o expo-updates escolher o pacote
  assert.match(read('ios/Podfile'), /^ENV\['EX_UPDATES_CUSTOM_INIT'\] = '1'$/m);
});

test('runtime-version.cjs prints only the runtime version, the same the build would embed', async () => {
  for (const platform of ['android', 'ios']) {
    const stdout = execFileSync(process.execPath, [script, platform], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(stdout, /^[0-9a-f]{40}\n$/, platform);
    const { hash } = await hashedFiles(platform);
    assert.equal(stdout.trim(), hash, platform);
  }
  assert.equal(
    runtimeVersion('android', {
      env: { ...process.env, EXPO_UPDATES_FINGERPRINT_OVERRIDE: 'qa-1' },
    }),
    'qa-1',
  );
  const unknown = spawnSync(process.execPath, [script, 'web'], {
    encoding: 'utf8',
  });
  assert.equal(unknown.status, 1);
  assert.equal(unknown.stdout, '');
});

test('the runtime version follows the native side and ignores JS and machine-local files', async () => {
  const native = {
    android: [
      'android/app/build.gradle',
      'android/app/src/main/AndroidManifest.xml',
      'android/app/src/main/java/com/aouerjmobile/MainApplication.kt',
      'android/gradle.properties',
      'node_modules/react-native/package.json',
      'node_modules/expo-updates/package.json',
      'node_modules/react-native-screens/package.json',
    ],
    ios: [
      'ios/Podfile',
      'ios/AOUerjMobile/Info.plist',
      'ios/AOUerjMobile/Expo.plist',
      'ios/AOUerjMobile/SceneDelegate.swift',
      'ios/AOUerjMobile/Native/AppNotificationsModule.mm',
      'ios/AOUerjMobile.xcodeproj/project.pbxproj',
      'node_modules/react-native/package.json',
      'node_modules/expo-updates/package.json',
    ],
  };
  const ignored = new Set(
    execFileSync(
      'git',
      [
        'ls-files',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--',
        'android',
        'ios',
        'config',
        'patches',
        'src/specs',
      ],
      { cwd: root, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean),
  );
  for (const platform of ['android', 'ios']) {
    const { files } = await hashedFiles(platform);
    for (const file of [
      ...native[platform],
      'src/specs/NativeAppNotifications.ts',
      'config/ota/certificate.pem',
      'patches/react-native-share@12.3.1.patch',
    ]) {
      assert.ok(files.includes(file), `${platform}: ${file}`);
    }
    const other = platform === 'android' ? 'ios/' : 'android/';
    for (const file of files) {
      // o JavaScript (as atualizações OTA) nunca muda o runtime version
      assert.ok(
        !file.startsWith('src/') || file.startsWith('src/specs/'),
        `${platform}: ${file}`,
      );
      assert.ok(!file.startsWith(other), `${platform}: ${file}`);
      // nem os arquivos fora do Git (caminho do SDK, segredos do release, caches)
      assert.ok(!ignored.has(file), `${platform}: ${file} is ignored by Git`);
    }
  }
});

test('the fingerprint reads CRLF checkouts (Git for Windows) as the LF of CI', () => {
  const strip = fingerprintConfig.fileHookTransform;
  const source = { type: 'file', filePath: 'android/build.gradle' };
  assert.deepEqual(
    strip(source, Buffer.from('a\r\nb\r\n'), false, 'buffer'),
    Buffer.from('a\nb\n'),
  );
  const lf = Buffer.from('a\nb\n');
  assert.equal(strip(source, lf, false, 'buffer'), lf);
  assert.equal(
    strip({ type: 'contents', id: 'x' }, 'a\r\nb', true, 'utf8'),
    'a\nb',
  );
  assert.equal(strip(source, null, true, 'utf8'), null);
});
