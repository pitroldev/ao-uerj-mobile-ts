const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { resolveRelease } = require('../ci/release-ref.cjs');

const repository = mkdtempSync(path.join(os.tmpdir(), 'aouerj-release-test-'));
after(() => rmSync(repository, { recursive: true, force: true }));
const git = (...args) =>
  execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim();
const commit = version => {
  writeFileSync(
    path.join(repository, 'package.json'),
    JSON.stringify({ version }),
  );
  git('add', 'package.json');
  git(
    '-c',
    'user.name=CI',
    '-c',
    'user.email=ci@example.test',
    'commit',
    '-m',
    version,
  );
  return git('rev-parse', 'HEAD');
};
git('init', '--initial-branch=main');
const previousSha = commit('2.0.0');
git('tag', 'v2.0.0');
const releaseSha = commit('2.1.0');
git(
  '-c',
  'user.name=CI',
  '-c',
  'user.email=ci@example.test',
  'tag',
  '-a',
  'v2.1.0',
  '-m',
  'release',
);
git('tag', 'v2.1.1');
git('update-ref', 'refs/remotes/origin/main', releaseSha);
git('checkout', '-b', 'unmerged');
commit('2.2.0');
git('tag', 'v2.2.0');

test('release resolves annotated and lightweight tags to their immutable main commit', () => {
  assert.deepEqual(resolveRelease('v2.1.0', repository), {
    tag: 'v2.1.0',
    sha: releaseSha,
  });
  assert.deepEqual(resolveRelease('v2.0.0', repository), {
    tag: 'v2.0.0',
    sha: previousSha,
  });
});

test('release rejects branches, malformed tags and shell metacharacters', () => {
  for (const tag of [
    undefined,
    '',
    'main',
    '2.1.0',
    'v02.1.0',
    'v2.1.0-beta',
    'v2.1.0;whoami',
    'v2.1.0\n',
  ]) {
    assert.throws(() => resolveRelease(tag, repository), /formato/);
  }
});

test('release rejects missing tags and commits not merged into main', () => {
  assert.throws(() => resolveRelease('v9.9.9', repository), /commit da main/);
  assert.throws(() => resolveRelease('v2.2.0', repository), /commit da main/);
});

test('release compares the tag to package.json from that commit, not the working tree', () => {
  assert.throws(() => resolveRelease('v2.1.1', repository), /não corresponde/);
  assert.equal(resolveRelease('v2.1.0', repository).sha, releaseSha);
});
