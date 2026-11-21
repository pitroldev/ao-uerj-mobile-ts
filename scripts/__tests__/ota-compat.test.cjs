const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  bundleChanged,
  compatibilityProblems,
  specMethods,
} = require('../ci/ota-compat.cjs');
const {
  changelogSection,
  iosBuild,
  releaseNotes,
  versionCode,
} = require('../ci/release-notes.cjs');

const spec = methods => `import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** comentário com (parênteses): não conta */
${methods.map(method => `  ${method}`).join('\n')}
}

export default TurboModuleRegistry.get<Spec>('X');
`;

/** Um Git de mentira: arquivos por commit e o que o grep acha. */
function fakeGit(trees, guards = []) {
  return {
    changed: (from, to) => {
      const files = new Set([
        ...Object.keys(trees[from]),
        ...Object.keys(trees[to]),
      ]);
      return [...files].filter(file => trees[from][file] !== trees[to][file]);
    },
    show: (ref, file) => trees[ref][file] ?? null,
    files: (ref, dir) =>
      Object.keys(trees[ref]).filter(file => file.startsWith(dir)),
    // o padrão é ERE do git grep; a classe POSIX vira a do JS
    grep: (_ref, pattern) =>
      guards
        .filter(([, code]) =>
          new RegExp(pattern.replaceAll('[[:space:]]', '\\s')).test(code),
        )
        .map(([file]) => file),
  };
}

const notifications = 'src/specs/NativeAppNotifications.ts';
const base = {
  'package.json': JSON.stringify({
    version: '2.19.0',
    dependencies: { 'react-native-svg': '15.16.0', dayjs: '1.11.0' },
    codegenConfig: { name: 'AppSpecs' },
  }),
  'app.json': JSON.stringify({
    name: 'app',
    runtimeVersion: { policy: 'fingerprint' },
  }),
  'config/ota/certificate.pem': 'cert-1',
  [notifications]: spec([
    'areNotificationsEnabled(): Promise<boolean>;',
    'notify(payload: { title: string; body: string }): Promise<void>;',
  ]),
  'android/app/src/main/AndroidManifest.xml': '<manifest/>',
};

const check = (next, guards) =>
  compatibilityProblems({
    from: 'store',
    to: 'main',
    git: fakeGit({ store: base, main: { ...base, ...next } }, guards),
    nativePackage: name => name !== 'dayjs',
  });

test('the spec methods are read with their signatures, comments and object types aside', () => {
  const methods = specMethods(base[notifications]);
  assert.deepEqual([...methods.keys()], ['areNotificationsEnabled', 'notify']);
  assert.equal(methods.get('notify'), '(payload: {…}): Promise<void>');
});

test('native implementation changes and a JS-only dependency do not stop the JS', () => {
  assert.deepEqual(
    check({
      'android/app/src/main/AndroidManifest.xml': '<manifest uses-feature/>',
      'package.json': JSON.stringify({
        version: '2.20.0',
        dependencies: { 'react-native-svg': '15.16.0', dayjs: '1.11.13' },
        codegenConfig: { name: 'AppSpecs' },
      }),
      'app.json': base['app.json'],
    }),
    [],
  );
});

test('a new native method needs the JS to check it exists before calling it', () => {
  const withToken = {
    [notifications]: spec([
      'areNotificationsEnabled(): Promise<boolean>;',
      'notify(payload: { title: string; body: string }): Promise<void>;',
      'remoteNotificationToken(): Promise<string | null>;',
    ]),
  };
  const [problem] = check(withToken);
  assert.match(
    problem,
    /NativeAppNotifications\.remoteNotificationToken é novo no nativo/,
  );
  assert.deepEqual(
    check(withToken, [
      [
        'src/adapters/outbound/native/NativeNotifications.ts',
        "typeof module.remoteNotificationToken === 'function'",
      ],
    ]),
    [],
  );
  // a conferência num teste não vale
  assert.equal(
    check(withToken, [
      [
        'src/adapters/__tests__/x.test.ts',
        "typeof m.remoteNotificationToken === 'function'",
      ],
    ]).length,
    1,
  );
});

test('a changed signature, a native dependency, the codegen, the certificate and app.json stop the JS', () => {
  const problems = check({
    [notifications]: spec([
      'areNotificationsEnabled(): Promise<boolean>;',
      'notify(payload: { title: string }, channel: string): Promise<void>;',
    ]),
    'package.json': JSON.stringify({
      version: '2.20.0',
      dependencies: { 'react-native-svg': '15.17.0', 'expo-camera': '1.0.0' },
      codegenConfig: { name: 'OtherSpecs' },
    }),
    'config/ota/certificate.pem': 'cert-2',
    'app.json': JSON.stringify({ name: 'app', runtimeVersion: '1' }),
  });
  assert.deepEqual(
    problems.map(problem => problem.split(/[:(]/)[0].trim()),
    [
      'O certificado das atualizações mudou',
      'O app.json mudou além da versão.',
      'O codegenConfig do package.json mudou.',
      'A dependência nativa react-native-svg mudou',
      'A dependência nativa expo-camera é nova.',
      'NativeAppNotifications.notify mudou de assinatura',
    ],
  );
});

test('a new native module must be read with TurboModuleRegistry.get', () => {
  const enforcing = spec(['x(): void;']).replace('.get<', '.getEnforcing<');
  assert.match(
    check({ 'src/specs/NativeNew.ts': enforcing })[0],
    /NativeNew é novo e é lido com getEnforcing/,
  );
  assert.deepEqual(
    check({ 'src/specs/NativeNew.ts': spec(['x(): void;']) }),
    [],
  );
});

test('only what goes into the app bundle counts as a JS change', () => {
  const trees = {
    a: { 'server/x.ts': '1', 'docs/a.md': '1', 'src/a.ts': '1' },
    b: { 'server/x.ts': '2', 'docs/a.md': '2', 'src/a.ts': '1' },
    c: { 'server/x.ts': '2', 'docs/a.md': '2', 'src/a.ts': '2' },
  };
  const git = fakeGit(trees);
  assert.equal(bundleChanged({ from: 'a', to: 'b', git }), false);
  assert.equal(bundleChanged({ from: 'b', to: 'c', git }), true);
});

test('the release notes are the CHANGELOG section plus the Android and iPhone versions', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 2.20.0 (2026-11-20)',
    '',
    '### Novidades',
    '',
    '- Pontos de ônibus.',
    '',
    '## 2.19.0 (2026-11-18)',
    '',
    '- Antes.',
  ].join('\r\n');
  const pbxproj =
    'CURRENT_PROJECT_VERSION = 30;\nCURRENT_PROJECT_VERSION = 30;\n';
  assert.equal(
    releaseNotes({ tag: 'v2.20.0', changelog, pbxproj }),
    '### Novidades\n\n- Pontos de ônibus.\n\nAndroid: versão v2.20.0, código 20200000.\niPhone: versão 2.20.0, build 30.\n',
  );
  assert.equal(versionCode([1, 3, 6]), 10030006);
  assert.throws(
    () => changelogSection(changelog, '2.21.0'),
    /não tem a seção da 2\.21\.0/,
  );
  assert.throws(
    () =>
      iosBuild('CURRENT_PROJECT_VERSION = 30;\nCURRENT_PROJECT_VERSION = 31;'),
    /um CURRENT_PROJECT_VERSION só, e tem 2/,
  );
  assert.throws(
    () => releaseNotes({ tag: '2.20', changelog, pbxproj }),
    /Tag inválida/,
  );
});
