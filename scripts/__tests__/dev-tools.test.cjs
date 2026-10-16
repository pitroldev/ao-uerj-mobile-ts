const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  ROUTES,
  parseArgs,
  parseDevices,
  pickDevice,
  resolveShots,
} = require('../dev/screenshots.cjs');
const {
  dismissKeyboard,
  ensureRealLogin,
  fillField,
  parseNodes,
  readCredentials,
  readScreen,
  textCommands,
} = require('../dev/login.cjs');

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
    'mapa',
    'progresso',
    'documentos',
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

test('screenshot options use real authentication and reject scenario switching', () => {
  const options = parseArgs([
    '--out',
    'tmp',
    '--wait',
    '100',
    '--no-reverse',
    'inicio',
  ]);
  assert.equal(options.out, 'tmp');
  assert.equal(options.login, true);
  assert.equal(options.wait, 100);
  assert.equal(options.reverse, false);
  assert.deepEqual(options.shots, ['inicio']);
  assert.throws(() => parseArgs(['--scenario', 'x']), /Opção desconhecida/);
  assert.throws(() => parseArgs(['--wait']), /Informe um valor/);
  assert.equal(parseArgs(['--no-login']).login, false);
});

test('credentials are read without mutating the process environment', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-login-test-'));
  const envFile = path.join(folder, '.env');
  fs.writeFileSync(
    envFile,
    'AO_MATRICULA="123"\nAO_PASSWORD="quoted # value"\n',
  );
  const before = process.env.AO_MATRICULA;
  try {
    assert.deepEqual(readCredentials(envFile, {}), {
      matricula: '123',
      password: 'quoted # value',
    });
    assert.deepEqual(readCredentials(envFile, { AO_PASSWORD: 'override' }), {
      matricula: '123',
      password: 'override',
    });
    assert.equal(process.env.AO_MATRICULA, before);
    assert.throws(
      () => readCredentials(path.join(folder, 'missing'), {}),
      /Configure AO_MATRICULA/,
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('login locates accessible native fields without fixed account names', () => {
  const nodes = parseNodes(
    '<node text="" content-desc="Matrícula" class="android.widget.EditText" bounds="[10,20][110,60]"/><node text="A &amp; B" bounds="[0,0][10,10]"/>',
  );
  assert.equal(nodes[0]['content-desc'], 'Matrícula');
  assert.equal(nodes[0].x, 60);
  assert.equal(nodes[0].y, 40);
  assert.equal(nodes[1].text, 'A & B');
});

test('password input travels through stdin with shell metacharacters quoted', () => {
  const calls = [];
  const adb = { tap() {}, run: (...args) => calls.push(args) };
  fillField(adb, { x: 20, y: 30 }, "pa'ss $(id)`x`;\\ %s");
  assert.deepEqual(calls[0][0], ['shell', 'sh']);
  assert.equal(calls[0][1].sensitive, true);
  assert.match(calls[0][1].input, /input text 'pa'\\''ss'/);
  assert.match(calls[0][1].input, /input text '%'\ninput text 's'/);
  assert.match(calls[0][1].input, /input keyevent KEYCODE_SPACE/);
  assert.throws(() => textCommands('line\nbreak'), /ASCII/);
});

test('hardware keyboard login does not send Back and close the app', () => {
  let backCount = 0;
  dismissKeyboard({
    run: () => 'mInputShown=false mIsInputViewShown=false',
    back: () => {
      backCount += 1;
    },
  });
  assert.equal(backCount, 0);
  dismissKeyboard({
    run: () => 'mInputShown=true',
    back: () => {
      backCount += 1;
    },
  });
  assert.equal(backCount, 1);
});

test('a development error fails immediately without exposing its contents', () => {
  assert.throws(
    () =>
      readScreen({
        screenText: () =>
          '<node text="Console Error"/><node text="private account details"/>',
      }),
    error => {
      assert.match(error.message, /erro de desenvolvimento/);
      assert.doesNotMatch(error.message, /private account/);
      return true;
    },
  );
});

test('signed-out launch does not open a private deep link before authenticating', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-login-test-'));
  const envFile = path.join(folder, '.env');
  fs.writeFileSync(envFile, 'AO_MATRICULA="123"\nAO_PASSWORD="password"\n');
  const calls = [];
  try {
    await assert.rejects(
      ensureRealLogin(
        {
          launch: () => calls.push('launch'),
          open: () => calls.push('open'),
          screenText: () => '<node text="Console Error"/>',
        },
        { envFile },
      ),
      /erro de desenvolvimento/,
    );
    assert.deepEqual(calls, ['launch']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
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
