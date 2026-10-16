#!/usr/bin/env node
/* Real Android login through the normal form. Credentials never enter argv or artifacts. */
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const {
  createAdb,
  findAdb,
  parseDevices,
  pickDevice,
} = require('./android.cjs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const projectRoot = path.resolve(__dirname, '../..');

function readCredentials(
  envFile = path.join(projectRoot, '.env'),
  env = process.env,
) {
  const file = fs.existsSync(envFile)
    ? parseEnv(fs.readFileSync(envFile, 'utf8'))
    : {};
  const credentials = {
    matricula: env.AO_MATRICULA ?? file.AO_MATRICULA,
    password: env.AO_PASSWORD ?? file.AO_PASSWORD,
  };
  if (!credentials.matricula || !credentials.password) {
    throw new Error(
      'Configure AO_MATRICULA e AO_PASSWORD no .env ou no ambiente.',
    );
  }
  return credentials;
}

function xmlDecode(value) {
  return value.replace(
    /&#(x[\da-f]+|\d+);|&(quot|apos|amp|lt|gt);/gi,
    (_, numeric, name) => {
      if (numeric)
        return String.fromCodePoint(
          numeric[0].toLowerCase() === 'x'
            ? parseInt(numeric.slice(1), 16)
            : Number(numeric),
        );
      return { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[name];
    },
  );
}

function parseNodes(xml) {
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(([, attributes]) => {
    const node = Object.fromEntries(
      [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        xmlDecode(value),
      ]),
    );
    const bounds = node.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
    if (bounds) {
      node.x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
      node.y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
    }
    return node;
  });
}

function labeled(nodes, label) {
  return nodes.find(
    node => node['content-desc'] === label || node.text === label,
  );
}

function tap(adb, node) {
  if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y))
    throw new Error('Controle esperado não encontrado no formulário.');
  adb.tap(node.x, node.y);
}

function readScreen(adb) {
  const nodes = parseNodes(adb.screenText());
  if (
    nodes.some(node =>
      /^(?:Console Error|Render Error|Uncaught Error|Syntax Error|Bundling failed)(?:$|\s*\()/i.test(
        node.text || node['content-desc'] || '',
      ),
    )
  ) {
    throw new Error(
      'O app exibiu uma tela de erro de desenvolvimento. Corrija o erro antes de tentar o login.',
    );
  }
  return nodes;
}

async function waitForNode(adb, predicate, stage, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const node = predicate(readScreen(adb));
    if (node && Number.isFinite(node.x) && Number.isFinite(node.y)) return node;
    await sleep(500);
  }
  throw new Error(`O controle esperado não apareceu na etapa ${stage}.`);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function textCommands(value) {
  if (!/^[\x20-\x7e]+$/.test(value)) {
    throw new Error(
      'O preenchimento por adb aceita caracteres ASCII imprimíveis. Entre manualmente e use --no-login.',
    );
  }
  // Separate % and spaces so Android's input-text %s expansion cannot alter a password.
  return value
    .match(/[^% ]+|%| /g)
    .map(part =>
      part === ' '
        ? 'input keyevent KEYCODE_SPACE'
        : `input text ${shellQuote(part)}`,
    )
    .join('\n');
}

function fillField(adb, node, value) {
  tap(adb, node);
  const existingLength = Math.min((node.text || '').length, 1024);
  const commands = [
    ...(existingLength
      ? [
          'input keyevent KEYCODE_MOVE_END',
          `input keyevent ${Array(existingLength).fill('KEYCODE_DEL').join(' ')}`,
        ]
      : []),
    textCommands(value),
  ].join('\n');
  // The host process arguments are only "adb shell sh". Do not surface stderr/stdout.
  adb.run(['shell', 'sh'], { input: `${commands}\n`, sensitive: true });
}

function dismissKeyboard(adb) {
  // With a hardware keyboard there may be no IME: unconditional Back closes the app.
  const keyboard = String(
    adb.run(['shell', 'dumpsys', 'input_method'], { allowFailure: true }) || '',
  );
  if (/mInputShown=true|mIsInputViewShown=true/.test(keyboard)) adb.back();
}

async function ensureRealLogin(adb, { loginTimeout = 180000, envFile } = {}) {
  const credentials = readCredentials(envFile);
  const deadline = Date.now() + loginTimeout;
  let submitted = false;
  let accountChecked = false;
  adb.launch();
  while (Date.now() < deadline) {
    const nodes = readScreen(adb);
    if (labeled(nodes, 'Funcionalidades exclusivas')) {
      const close = labeled(nodes, 'Entendi');
      if (close) tap(adb, close);
      else adb.back();
      await sleep(1000);
      continue;
    }
    const registration = nodes.find(
      node =>
        node.class === 'android.widget.EditText' &&
        node['content-desc'] === 'Matrícula',
    );
    if (registration && !submitted) {
      fillField(adb, registration, credentials.matricula);
      const password = await waitForNode(
        adb,
        current =>
          current.find(
            node =>
              node.class === 'android.widget.EditText' &&
              node['content-desc'] === 'Senha',
          ),
        'senha',
      );
      fillField(adb, password, credentials.password);
      dismissKeyboard(adb);
      tap(
        adb,
        await waitForNode(
          adb,
          current => labeled(current, 'Entrar'),
          'enviar login',
        ),
      );
      submitted = true;
      await sleep(1500);
      continue;
    }
    if (
      submitted &&
      nodes.some(node =>
        /inválida|inexistente|Não foi possível entrar|portal em manutenção/i.test(
          node.text || '',
        ),
      )
    ) {
      throw new Error(
        'O portal não concluiu o login. Confira a conta e a disponibilidade do Aluno Online.',
      );
    }
    const menu = labeled(nodes, 'Abrir menu');
    if (menu && !accountChecked) {
      tap(adb, menu);
      await waitForNode(
        adb,
        current => labeled(current, 'Sair'),
        'conferir conta',
      );
      const drawer = readScreen(adb);
      if (labeled(drawer, `Matrícula ${credentials.matricula}`)) {
        adb.back();
        accountChecked = true;
        continue;
      }
      // Replace a previously stored account through the normal logout control.
      tap(adb, labeled(drawer, 'Sair'));
      submitted = false;
      await sleep(1000);
      continue;
    }
    if (accountChecked && menu) {
      // Private routes exist only after authentication has restored the navigator.
      adb.open('aouerj-dev://inicio');
      await waitForNode(
        adb,
        current => labeled(current, 'Abrir menu'),
        'abrir Início',
      );
      return;
    }
    await sleep(1200);
  }
  throw new Error(
    `O login real não terminou em ${Math.round(loginTimeout / 1000)} s. Confira o portal, o Metro e o build instalado.`,
  );
}

function parseArgs(argv) {
  const options = {
    adb: process.env.ADB,
    serial: process.env.ANDROID_SERIAL,
    loginTimeout: 180000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help') {
      options.help = true;
      continue;
    }
    if (!['--adb', '--serial', '--env-file', '--login-timeout'].includes(flag))
      throw new Error(`Opção desconhecida: ${flag}`);
    const value = argv[++index];
    if (!value || value.startsWith('--'))
      throw new Error(`Informe um valor para ${flag}.`);
    if (flag === '--adb') options.adb = value;
    if (flag === '--serial') options.serial = value;
    if (flag === '--env-file') options.envFile = path.resolve(value);
    if (flag === '--login-timeout') {
      options.loginTimeout = Number(value);
      if (!Number.isFinite(options.loginTimeout) || options.loginTimeout <= 0)
        throw new Error('--login-timeout precisa ser maior que zero.');
    }
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(
      'Uso: node scripts/dev/login.cjs [--adb caminho] [--serial id] [--env-file .env] [--login-timeout ms]\nCredenciais: AO_MATRICULA e AO_PASSWORD no .env ou ambiente.',
    );
    return;
  }
  const executable = findAdb(options.adb);
  const serial = pickDevice(
    parseDevices(createAdb(executable).run(['devices'])),
    options.serial,
  );
  const adb = createAdb(executable, serial);
  adb.run(['reverse', 'tcp:8081', 'tcp:8081']);
  await ensureRealLogin(adb, options);
  console.log('Conta configurada conferida no app.');
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  dismissKeyboard,
  ensureRealLogin,
  fillField,
  parseArgs,
  parseNodes,
  readCredentials,
  readScreen,
  textCommands,
  waitForNode,
};
