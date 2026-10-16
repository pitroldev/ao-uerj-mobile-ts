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

test('the distributable GeoJSON uses the same original lake symbol as the app', () => {
  const scheme = require('../campus-map/data/esquema-pavilhao.json');
  const atlas = require('../../src/adapters/outbound/campus-map/atlas.json');
  const geo = JSON.parse(
    fs.readFileSync(
      path.join(root, 'scripts/campus-map/data/pavilhao-e-campus.geojson'),
      'utf8',
    ),
  );
  const feature = geo.features.find(
    item => item.properties.id === 'lago-dos-peixinhos',
  );
  assert.equal(feature.properties.representacao, 'simbolo-esquematico');
  assert.equal(feature.properties.origem_geometria, 'simbolo-proprio');
  assert.equal('area_m2' in feature.properties, false);
  assert.equal('dimensoes' in feature.properties, false);
  assert.doesNotMatch(JSON.stringify(feature), /Mosaico_|465538619/);

  const ring = atlas.shapes.find(item => item.id === feature.properties.id)
    .rings[0];
  const [a, b, c] = scheme.referencial.para_wgs84.lon;
  const [d, e, f] = scheme.referencial.para_wgs84.lat;
  const projected = [...ring, ring[0]].map(([x, y]) =>
    [a + b * x + c * y, d + e * x + f * y].map(
      value => Math.round(value * 1e7) / 1e7,
    ),
  );
  assert.deepEqual(feature.geometry.coordinates[0], projected);
});
