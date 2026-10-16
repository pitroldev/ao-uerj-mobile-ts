#!/usr/bin/env node
/*
 * Capturas de tela do app (build de DEBUG) em um emulador/dispositivo Android,
 * usando a conta real do .env e os deep links aouerj-dev://. Ver README.md.
 *
 *   node scripts/dev/screenshots.cjs [opções] [rota | nome=caminho ...]
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  PACKAGE,
  createAdb,
  findAdb,
  parseDevices,
  pickDevice,
} = require('./android.cjs');
const { ensureRealLogin } = require('./login.cjs');

const PREFIX = 'aouerj-dev://';
/** Nome do arquivo → caminho do deep link. */
const ROUTES = {
  inicio: 'inicio',
  mapa: 'mapa',
  progresso: 'progresso',
  documentos: 'documentos',
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
  --wait <ms>            espera depois de abrir cada rota (padrão: 2500)
  --login-timeout <ms>   espera máxima pelo login real (padrão: 180000)
  --no-login             usa a sessão real já autenticada, sem ler credenciais
  --no-reverse           não executa "adb reverse tcp:8081 tcp:8081"
  --adb <caminho>        executável do adb (padrão: ANDROID_HOME/platform-tools)
  --help                 mostra esta ajuda`;

function parseArgs(argv) {
  const options = {
    out: null,
    serial: process.env.ANDROID_SERIAL || null,
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    console.log(`[${serial}] Conferindo a sessão da conta real...`);
    await ensureRealLogin(adb, options);
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
  parseArgs,
  parseDevices,
  pickDevice,
  resolveShots,
};
