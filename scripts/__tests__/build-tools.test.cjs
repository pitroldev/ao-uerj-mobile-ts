const assert = require('node:assert/strict');
const { test } = require('node:test');
const { gradleCommand } = require('../gradle.cjs');

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
