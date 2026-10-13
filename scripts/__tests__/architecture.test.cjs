const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const oxlint = path.join(root, 'node_modules/oxlint/bin/oxlint');

/**
 * Lints fixtures ({ relative path: source }) with the repo's .oxlintrc.json
 * from a temporary directory laid out like the repo, so the override globs
 * (src/**, src/modules/**\/domain/**) apply as they do in src/. Type-aware
 * rules stay off: they need the repo's TypeScript program and are not under
 * test here. Returns the files with a no-restricted-imports diagnostic.
 */
function filesWithRestrictedImports(fixtures) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-architecture-'));
  try {
    fs.writeFileSync(
      path.join(dir, '.oxlintrc.json'),
      JSON.stringify({
        extends: [path.join(root, '.oxlintrc.json')],
        options: { typeAware: false },
      }),
    );
    for (const [file, source] of Object.entries(fixtures)) {
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), source);
    }
    const result = spawnSync(process.execPath, [oxlint, '--format=json'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.ok(result.stdout, result.stderr || 'oxlint printed nothing');
    const { diagnostics } = JSON.parse(result.stdout);
    return new Set(
      diagnostics
        .filter(d => d.code === 'eslint(no-restricted-imports)')
        .map(d => d.filename.replace(/\\/g, '/')),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const importOf = dependency =>
  `import dependency from '${dependency}';\nexport default dependency;\n`;

test('domain/application reject frameworks and outbound implementation imports', () => {
  const forbidden = [
    'react',
    'axios',
    'react-native',
    '@react-native-community/netinfo',
    '@root/adapters/outbound/private-api',
    '@root/app/providers/AppServicesProvider',
    '@root/services/parser',
  ];
  const fixtures = {};
  for (const layer of ['domain', 'application']) {
    const dir = `src/modules/example/${layer}`;
    forbidden.forEach((dependency, i) => {
      fixtures[`${dir}/Forbidden${i}.ts`] = importOf(dependency);
    });
    fixtures[`${dir}/Allowed.ts`] =
      "import type { SomePort } from './ports';\nexport type Port = SomePort;\n";
  }

  const flagged = filesWithRestrictedImports(fixtures);
  for (const layer of ['domain', 'application']) {
    const dir = `src/modules/example/${layer}`;
    forbidden.forEach((dependency, i) => {
      assert.ok(
        flagged.has(`${dir}/Forbidden${i}.ts`),
        `${layer}: ${dependency}`,
      );
    });
    assert.ok(!flagged.has(`${dir}/Allowed.ts`), `${layer}: ./ports`);
  }
});

test('src rejects the cheerio root, react-native-cheerio and the toast lib', () => {
  const forbidden = [
    'cheerio',
    'react-native-cheerio',
    'react-native-toast-message',
  ];
  const fixtures = {
    'src/features/Example/Allowed.ts': importOf('cheerio/slim'),
  };
  forbidden.forEach((dependency, i) => {
    fixtures[`src/features/Example/Forbidden${i}.ts`] = importOf(dependency);
  });

  const flagged = filesWithRestrictedImports(fixtures);
  forbidden.forEach((dependency, i) => {
    assert.ok(flagged.has(`src/features/Example/Forbidden${i}.ts`), dependency);
  });
  assert.ok(!flagged.has('src/features/Example/Allowed.ts'), 'cheerio/slim');
});
