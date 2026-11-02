const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { planVersionTag } = require('../ci/version-tag.cjs');

const repository = mkdtempSync(path.join(os.tmpdir(), 'aouerj-version-tag-'));
after(() => rmSync(repository, { recursive: true, force: true }));
const git = (...args) =>
  execFileSync(
    'git',
    ['-c', 'user.name=CI', '-c', 'user.email=ci@example.test', ...args],
    { cwd: repository, encoding: 'utf8', stdio: 'pipe' },
  ).trim();
const commit = (message, files) => {
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(repository, name), content);
    git('add', name);
  }
  git('commit', '-m', message);
  return git('rev-parse', 'HEAD');
};
const manifest = (version, extra = {}) =>
  JSON.stringify({ name: 'app', version, ...extra });

git('init', '--initial-branch=main');
const released = commit('chore: release 2.0.0', {
  'package.json': manifest('2.0.0'),
});
git('tag', '-a', 'v2.0.0', '-m', 'Release v2.0.0');
commit('feat: algo', { 'app.ts': 'novo' });
const bump = commit('chore: release 2.0.1', {
  'package.json': manifest('2.0.1'),
});
// mudanças de dependência depois do bump não são o bump
commit('build: dependência', {
  'package.json': manifest('2.0.1', { dependencies: { a: '1' } }),
});
const head = commit('fix: outra coisa', { 'app.ts': 'corrigido' });

test('a hand-made bump without a tag gets one on the bump commit, not on HEAD', () => {
  assert.deepEqual(planVersionTag(repository), {
    tag: 'v2.0.1',
    sha: bump,
    create: true,
  });
});

test('a version that already has its tag needs nothing', () => {
  assert.deepEqual(planVersionTag(repository, released), {
    tag: 'v2.0.0',
    sha: released,
    create: false,
  });
  git('tag', 'v2.0.1', bump);
  assert.equal(planVersionTag(repository).create, false);
  git('tag', '-d', 'v2.0.1');
});

test('a tag on another commit is never moved', () => {
  git('tag', 'v2.0.1', head);
  assert.throws(() => planVersionTag(repository), /não é movida/);
  git('tag', '-d', 'v2.0.1');
});

test('a package.json without a release version stops the job', () => {
  const broken = commit('chore: quebra', {
    'package.json': manifest('2.1.0-beta'),
  });
  assert.throws(() => planVersionTag(repository, broken), /MAJOR.MINOR.PATCH/);
});
