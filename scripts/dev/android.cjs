const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE = 'com.aouerjmobile';

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state)
    .map(([serial, state]) => ({ serial, state }));
}

function pickDevice(devices, requested) {
  const online = devices.filter(device => device.state === 'device');
  if (requested) {
    const found = devices.find(device => device.serial === requested);
    if (!found) throw new Error(`Dispositivo ${requested} não encontrado.`);
    if (found.state !== 'device')
      throw new Error(`Dispositivo ${requested} está "${found.state}".`);
    return requested;
  }
  const emulators = online.filter(device =>
    device.serial.startsWith('emulator-'),
  );
  const candidates = emulators.length ? emulators : online;
  if (candidates.length === 1) return candidates[0].serial;
  if (!candidates.length)
    throw new Error(
      'Nenhum dispositivo online. Inicie o emulador (ver scripts/dev/README.md).',
    );
  throw new Error(
    `Vários dispositivos online (${candidates.map(device => device.serial).join(', ')}). Use --serial ou ANDROID_SERIAL.`,
  );
}

function findAdb(explicit) {
  if (explicit) return explicit;
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const roots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const root of roots) {
    const candidate = path.join(root, 'platform-tools', executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'adb';
}

function createAdb(executable, serial) {
  const run = (
    args,
    { binary = false, allowFailure = false, input, sensitive = false } = {},
  ) => {
    const result = spawnSync(
      executable,
      serial ? ['-s', serial, ...args] : args,
      {
        encoding: binary ? undefined : 'utf8',
        input,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        timeout: 45000,
      },
    );
    if ((result.error || result.status !== 0) && !allowFailure) {
      if (sensitive)
        throw new Error('Falha ao preencher o formulário pelo adb.');
      throw new Error(
        `adb ${args.join(' ')} falhou: ${result.error?.message || result.stderr || result.status}`,
      );
    }
    return result.stdout;
  };
  return {
    run,
    open(url) {
      run([
        'shell',
        'am',
        'start',
        '-W',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        url,
        PACKAGE,
      ]);
    },
    launch() {
      run(['shell', 'am', 'start', '-W', '-n', `${PACKAGE}/.MainActivity`]);
    },
    screenshot(file) {
      const png = run(['exec-out', 'screencap', '-p'], { binary: true });
      if (!png || png.length < 8 || png.readUInt32BE(0) !== 0x89504e47)
        throw new Error('screencap não devolveu um PNG.');
      fs.writeFileSync(file, png);
    },
    // The hierarchy may contain account data: keep it in memory, never on /sdcard or in logs.
    screenText() {
      return String(
        run(['exec-out', 'uiautomator', 'dump', '/dev/tty'], {
          allowFailure: true,
        }) || '',
      );
    },
    tap(x, y) {
      run(['shell', 'input', 'tap', String(x), String(y)]);
    },
    back() {
      run(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    },
  };
}

module.exports = { PACKAGE, createAdb, findAdb, parseDevices, pickDevice };
