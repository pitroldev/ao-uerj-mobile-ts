#!/usr/bin/env node
/*
 * Capturas de tela do app (build de DEBUG) em um emulador/dispositivo Android,
 * usando o modo demonstração e os deep links aouerj-dev://. Ver README.md.
 *
 *   node scripts/dev/screenshots.cjs [opções] [rota | nome=caminho ...]
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PREFIX = 'aouerj-dev://';
const PACKAGE = 'com.aouerjmobile';
const SCENARIOS = ['padrao', 'rid', 'vazio', 'bloqueado', 'erro', 'lento'];
/** Texto que só aparece depois do login demo (nome da aluna fictícia). */
const SIGNED_IN_MARKER = 'Marina';
/** Título da folha de novidades exibida no primeiro acesso. */
const WHATS_NEW_MARKER = 'Funcionalidades exclusivas';

/** Nome do arquivo → caminho do deep link. */
const ROUTES = {
  inicio: 'inicio',
  progresso: 'progresso',
  gerador: 'gerador',
  mural: 'mural',
  realizadas: 'realizadas',
  curriculo: 'curriculo',
  universais: 'universais',
  pesquisa: 'pesquisa',
  disciplina: 'pesquisa/IME02-10892',
  sobre: 'sobre',
};

const USAGE = `Uso: node scripts/dev/screenshots.cjs [opções] [rota | nome=caminho ...]

Rotas: ${Object.keys(ROUTES).join(', ')} (padrão: todas).
"nome=caminho" captura aouerj-dev://<caminho> em <nome>.png,
por exemplo: sd=pesquisa/IME02-10892

Opções:
  --out <pasta>          pasta de saída (padrão: <tmp>/aouerj-screenshots/<data>)
  --serial <id>          dispositivo do adb (padrão: ANDROID_SERIAL ou o único online)
  --scenario <nome>      cenário demo: ${SCENARIOS.join(', ')} (padrão: padrao)
  --wait <ms>            espera depois de abrir cada rota (padrão: 2500)
  --login-timeout <ms>   espera máxima pelo login demo (padrão: 180000)
  --no-login             não garante o login demo antes das capturas
  --no-reverse           não executa "adb reverse tcp:8081 tcp:8081"
  --adb <caminho>        executável do adb (padrão: ANDROID_HOME/platform-tools)
  --help                 mostra esta ajuda`;

function parseArgs(argv) {
  const options = {
    out: null,
    serial: process.env.ANDROID_SERIAL || null,
    scenario: 'padrao',
    wait: 2500,
    loginTimeout: 180000,
    login: true,
    reverse: true,
    adb: process.env.ADB || null,
    help: false,
    shots: [],
  };
  const valueOf = (flag, index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--'))
      throw new Error(`Informe um valor para ${flag}.`);
    return value;
  };
  const number = (flag, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
      throw new Error(`${flag} precisa ser um número de milissegundos.`);
    return parsed;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--out':
        options.out = valueOf(arg, index++);
        break;
      case '--serial':
        options.serial = valueOf(arg, index++);
        break;
      case '--scenario':
        options.scenario = valueOf(arg, index++);
        break;
      case '--wait':
        options.wait = number(arg, valueOf(arg, index++));
        break;
      case '--login-timeout':
        options.loginTimeout = number(arg, valueOf(arg, index++));
        break;
      case '--no-login':
        options.login = false;
        break;
      case '--no-reverse':
        options.reverse = false;
        break;
      case '--adb':
        options.adb = valueOf(arg, index++);
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Opção desconhecida: ${arg}`);
        options.shots.push(arg);
    }
  }
  if (!SCENARIOS.includes(options.scenario))
    throw new Error(
      `Cenário desconhecido: ${options.scenario}. Use ${SCENARIOS.join(', ')}.`,
    );
  return options;
}

/** Converte os argumentos em [{ name, path }], sem repetir nomes. */
function resolveShots(args) {
  const entries = args.length ? args : Object.keys(ROUTES);
  const shots = entries.map(entry => {
    const separator = entry.indexOf('=');
    if (separator > 0) {
      const name = entry.slice(0, separator);
      const route = entry.slice(separator + 1).replace(/^aouerj-dev:\/\//, '');
      return { name, path: route };
    }
    if (ROUTES[entry]) return { name: entry, path: ROUTES[entry] };
    throw new Error(
      `Rota desconhecida: ${entry}. Use ${Object.keys(ROUTES).join(
        ', ',
      )} ou nome=caminho.`,
    );
  });
  shots.forEach(shot => {
    if (!/^[\w.-]+$/.test(shot.name))
      throw new Error(`Nome de arquivo inválido: ${shot.name}`);
    if (!/^[\w/%.-]+$/.test(shot.path))
      throw new Error(`Caminho de deep link inválido: ${shot.path}`);
  });
  const names = new Set();
  shots.forEach(shot => {
    if (names.has(shot.name)) throw new Error(`Nome repetido: ${shot.name}`);
    names.add(shot.name);
  });
  return shots;
}

function demoUrl(scenario) {
  return scenario === 'padrao' ? `${PREFIX}demo` : `${PREFIX}demo/${scenario}`;
}

/** Saída de "adb devices" → [{ serial, state }]. */
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
    `Vários dispositivos online (${candidates
      .map(device => device.serial)
      .join(', ')}). Use --serial ou ANDROID_SERIAL.`,
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAdb(executable, serial) {
  const run = (args, { binary = false, allowFailure = false } = {}) => {
    const result = spawnSync(
      executable,
      serial ? ['-s', serial, ...args] : args,
      {
        encoding: binary ? undefined : 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0 && !allowFailure) {
      const stderr = Buffer.isBuffer(result.stderr)
        ? result.stderr.toString('utf8')
        : result.stderr;
      throw new Error(
        `adb ${args.join(' ')} falhou: ${stderr || result.status}`,
      );
    }
    return result.stdout;
  };
  return {
    run,
    open(url) {
      // -W espera a Activity; o pacote garante que só o app trate o link.
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
    screenshot(file) {
      const png = run(['exec-out', 'screencap', '-p'], { binary: true });
      if (!png || png.length < 8 || png.readUInt32BE(0) !== 0x89504e47)
        throw new Error('screencap não devolveu um PNG.');
      fs.writeFileSync(file, png);
    },
    /** Texto da janela em primeiro plano ('' se o dump falhar). */
    screenText() {
      const dump = '/sdcard/aouerj-ui.xml';
      // Remove o dump anterior: um dump que falha não pode parecer atual.
      run(['shell', 'rm', '-f', dump], { allowFailure: true });
      run(['shell', 'uiautomator', 'dump', dump], { allowFailure: true });
      return String(
        run(['exec-out', 'cat', dump], { allowFailure: true }) || '',
      );
    },
    back() {
      run(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    },
  };
}

/**
 * Abre o link de login demo e espera o Início. A folha "Funcionalidades
 * exclusivas" aparece no primeiro acesso de cada conta: ela é capturada em
 * novidades.png e fechada, senão cobriria as outras telas.
 */
async function ensureDemoLogin(adb, options, out) {
  adb.open(demoUrl(options.scenario));
  const deadline = Date.now() + options.loginTimeout;
  let confirmations = 0;
  while (Date.now() < deadline) {
    const text = adb.screenText();
    if (text.includes(WHATS_NEW_MARKER)) {
      await sleep(1000);
      const file = path.join(out, 'novidades.png');
      adb.screenshot(file);
      console.log(`${'novidades'.padEnd(12)} (primeiro acesso) -> ${file}`);
      adb.back();
      confirmations = 0;
      await sleep(1500);
      continue;
    }
    // Two consecutive sightings: the sheet opens shortly after the Início.
    confirmations = text.includes(SIGNED_IN_MARKER) ? confirmations + 1 : 0;
    if (confirmations >= 2) return;
    await sleep(confirmations ? 1500 : 2000);
  }
  throw new Error(
    `O login demo não apareceu em ${Math.round(
      options.loginTimeout / 1000,
    )} s. Confira se o Metro está rodando (pnpm start) e se o build de debug está instalado.`,
  );
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const shots = resolveShots(options.shots);
  const executable = findAdb(options.adb);
  const serial = pickDevice(
    parseDevices(createAdb(executable, null).run(['devices'])),
    options.serial,
  );
  const adb = createAdb(executable, serial);
  if (
    !String(
      adb.run(['shell', 'pm', 'path', PACKAGE], { allowFailure: true }),
    ).includes('package:')
  )
    throw new Error(
      `${PACKAGE} não está instalado em ${serial}. Instale o build de debug (ver README).`,
    );
  if (options.reverse) adb.run(['reverse', 'tcp:8081', 'tcp:8081']);

  const out = path.resolve(
    options.out ||
      path.join(
        os.tmpdir(),
        'aouerj-screenshots',
        new Date().toISOString().replace(/[:.]/g, '-'),
      ),
  );
  fs.mkdirSync(out, { recursive: true });

  if (options.login) {
    console.log(
      `[${serial}] Entrando no modo demonstração (${options.scenario})...`,
    );
    await ensureDemoLogin(adb, options, out);
    await sleep(options.wait);
  }
  for (const shot of shots) {
    adb.open(`${PREFIX}${shot.path}`);
    await sleep(options.wait);
    const file = path.join(out, `${shot.name}.png`);
    adb.screenshot(file);
    console.log(`${shot.name.padEnd(12)} ${PREFIX}${shot.path} -> ${file}`);
  }
  console.log(`${shots.length} captura(s) em ${out}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ROUTES,
  SCENARIOS,
  demoUrl,
  parseArgs,
  parseDevices,
  pickDevice,
  resolveShots,
};
