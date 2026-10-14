const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');

test('the bundled campus atlas matches its source geometry without rewriting it', () => {
  const atlas = path.join(root, 'src/adapters/outbound/campus-map/atlas.json');
  const before = fs.readFileSync(atlas);
  const modified = fs.statSync(atlas).mtimeMs;
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/generate-campus-map.cjs'), '--check'],
    { cwd: root, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(atlas), before);
  assert.equal(fs.statSync(atlas).mtimeMs, modified);
});
