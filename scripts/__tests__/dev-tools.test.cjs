const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  ROUTES,
  demoUrl,
  parseArgs,
  parseDevices,
  pickDevice,
  resolveShots,
} = require('../dev/screenshots.cjs');

const android = path.resolve(__dirname, '../../android/app/src');
const read = file => fs.readFileSync(path.join(android, file), 'utf8');

test('the aouerj-dev scheme exists only in the debug manifest', () => {
  assert.doesNotMatch(read('main/AndroidManifest.xml'), /aouerj-dev/);
  assert.equal(fs.existsSync(path.join(android, 'release')), false);
  const debug = read('debug/AndroidManifest.xml');
  assert.match(debug, /<data android:scheme="aouerj-dev" \/>/);
  assert.match(debug, /android:name="\.MainActivity" tools:node="merge"/);
});

test('screenshot routes cover every drawer screen', () => {
  assert.deepEqual(Object.values(ROUTES), [
    'inicio',
    'progresso',
    'gerador',
    'mural',
    'realizadas',
    'curriculo',
    'universais',
    'pesquisa',
    'pesquisa/IME02-10892',
    'sobre',
  ]);
  assert.deepEqual(resolveShots(['sobre', 'sd=aouerj-dev://pesquisa/10892']), [
    { name: 'sobre', path: 'sobre' },
    { name: 'sd', path: 'pesquisa/10892' },
  ]);
  assert.throws(() => resolveShots(['nada']), /Rota desconhecida/);
  assert.throws(() => resolveShots(['x=inicio;rm']), /inválido/);
  assert.throws(() => resolveShots(['sobre', 'sobre']), /repetido/);
});

test('screenshot options and demo links', () => {
  const options = parseArgs([
    '--out',
    'tmp',
    '--scenario',
    'rid',
    '--wait',
    '100',
    '--no-reverse',
    'inicio',
  ]);
  assert.equal(options.out, 'tmp');
  assert.equal(options.scenario, 'rid');
  assert.equal(options.wait, 100);
  assert.equal(options.reverse, false);
  assert.deepEqual(options.shots, ['inicio']);
  assert.throws(() => parseArgs(['--scenario', 'x']), /Cenário desconhecido/);
  assert.throws(() => parseArgs(['--wait']), /Informe um valor/);
  assert.equal(demoUrl('padrao'), 'aouerj-dev://demo');
  assert.equal(demoUrl('bloqueado'), 'aouerj-dev://demo/bloqueado');
});

test('device selection ignores offline emulators', () => {
  const devices = parseDevices(
    'List of devices attached\r\nemulator-5554\tdevice\r\nemulator-5560\toffline\r\n\r\n',
  );
  assert.deepEqual(devices, [
    { serial: 'emulator-5554', state: 'device' },
    { serial: 'emulator-5560', state: 'offline' },
  ]);
  assert.equal(pickDevice(devices, null), 'emulator-5554');
  assert.throws(() => pickDevice(devices, 'emulator-5560'), /offline/);
  assert.throws(
    () =>
      pickDevice(
        [...devices, { serial: 'emulator-5556', state: 'device' }],
        null,
      ),
    /Vários dispositivos/,
  );
});
