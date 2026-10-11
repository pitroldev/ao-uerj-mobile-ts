const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { gradleCommand } = require('../gradle.cjs');
const {
  patchAndroidDependencies,
  patchedCookiesGradle,
} = require('../patch-android-deps');

test('Gradle forwards tasks/options on Windows and POSIX', () => {
  const args = [
    'assembleDebug',
    '-PreactNativeArchitectures=x86_64',
    '--no-daemon',
  ];
  assert.deepEqual(gradleCommand(args, 'linux'), {
    command: 'sh',
    args: ['./gradlew', ...args],
  });
  assert.deepEqual(gradleCommand(args, 'darwin'), {
    command: 'sh',
    args: ['./gradlew', ...args],
  });
  assert.deepEqual(gradleCommand(args, 'win32').args, [
    '/d',
    '/s',
    '/c',
    `gradlew.bat ${args.join(' ')}`,
  ]);
  assert.throws(() => gradleCommand(['clean & echo unwanted'], 'win32'));
  assert.throws(() => gradleCommand([], 'linux'));
});

test('Android patch transforms every obsolete repository and is idempotent', () => {
  const source = 'repositories { jcenter(); jcenter () }';
  const patched = patchedCookiesGradle(source);
  assert.equal(patched, 'repositories { mavenCentral(); mavenCentral() }');
  assert.equal(patchedCookiesGradle(patched), patched);
  assert.throws(() =>
    patchedCookiesGradle('repositories { unknownRepository() }'),
  );
});

test('patch checker rejects missing targets and verifies writes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-gradle-patch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => patchAndroidDependencies({ root }));
  const filename = path.join(
    root,
    'node_modules/@react-native-cookies/cookies/android/build.gradle',
  );
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, 'repositories { jcenter() }');
  assert.throws(() => patchAndroidDependencies({ root, check: true }));
  assert.equal(patchAndroidDependencies({ root }), true);
  assert.equal(patchAndroidDependencies({ root, check: true }), false);
  assert.equal(patchAndroidDependencies({ root }), false);
});
