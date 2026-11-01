/*
 * Os comandos da VM que os scripts de implantação chamam e que não existem
 * (ou não podem rodar de verdade) num teste: pm2, sudo, nginx, systemctl,
 * corepack, curl, apt-get, npm, logrotate. Cada um é um atalho que chama
 * este arquivo com o próprio nome (ver support.mjs).
 *
 *   STUB_LOG    cada chamada vira uma linha JSON aqui
 *   STUB_STATE  o estado de mentira (processos do pm2, unidades do systemd)
 *   STUB_RULES  JSON: [{ cmd, match?, calls?: [n], exit?, stdout? }] — a
 *               chamada de `cmd` cujos argumentos contêm `match` falha (na
 *               n-ésima vez, com `calls`)
 *   STUB_FILES  o que o curl "baixa", pelo nome do arquivo da URL
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUB = fileURLToPath(import.meta.url);
// importado pelo support.mjs, só o `shortcut` interessa; executado, é o comando
const executed = process.argv[1] === STUB;
const [name, ...args] = executed ? process.argv.slice(2) : [];
const { STUB_LOG, STUB_STATE } = process.env;

// o ambiente que interessa aos testes (o pm2 start recebe a porta e o commit assim)
const ENV_KEYS = ['PORT', 'HOST', 'RELEASE_COMMIT', 'RELEASE_COLOR'];

function record() {
  appendFileSync(
    STUB_LOG,
    `${JSON.stringify({
      cmd: name,
      args,
      cwd: process.cwd(),
      env: Object.fromEntries(
        ENV_KEYS.filter(key => process.env[key] !== undefined).map(key => [
          key,
          process.env[key],
        ]),
      ),
    })}\n`,
  );
}

/** A regra que manda esta chamada falhar, se houver. */
function failure() {
  const joined = args.join(' ');
  const rules = JSON.parse(process.env.STUB_RULES || '[]');
  for (const [index, rule] of rules.entries()) {
    if (rule.cmd !== name || (rule.match && !joined.includes(rule.match))) {
      continue;
    }
    const counter = join(STUB_STATE, `rule-${index}.count`);
    const count =
      (existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0) + 1;
    writeFileSync(counter, String(count));
    if (!rule.calls || rule.calls.includes(count)) return rule;
  }
  return null;
}

const option = flag => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};

/** Um atalho executável que chama este arquivo como `command`. */
export function shortcut(command) {
  return `#!/bin/sh\nexec "${process.execPath}" "${STUB}" ${command} "$@"\n`;
}

const appsFile = () => join(STUB_STATE, 'pm2.json');
const apps = () =>
  existsSync(appsFile()) ? JSON.parse(readFileSync(appsFile(), 'utf8')) : [];
const keep = list => writeFileSync(appsFile(), JSON.stringify(list, null, 2));

function pm2() {
  const [command, target] = args;
  const list = apps();
  switch (command) {
    case 'start': {
      const app = option('--name');
      keep([
        ...list.filter(entry => entry.name !== app),
        {
          name: app,
          pm2_env: {
            status: 'online',
            pm_exec_path: target,
            pm_cwd: option('--cwd') ?? process.cwd(),
          },
          monit: { memory: 52_000_000 },
        },
      ]);
      return 0;
    }
    case 'delete':
      if (!list.some(entry => entry.name === target)) {
        console.error(`[PM2][ERROR] Process or Namespace ${target} not found`);
        return 1;
      }
      keep(list.filter(entry => entry.name !== target));
      return 0;
    case 'describe':
      return list.some(entry => entry.name === target) ? 0 : 1;
    case 'save':
      writeFileSync(join(STUB_STATE, 'pm2-dump.json'), JSON.stringify(list));
      return 0;
    case 'jlist':
      process.stdout.write(JSON.stringify(list));
      return 0;
    case 'logs': {
      const logs = join(STUB_STATE, 'pm2-logs.txt');
      if (existsSync(logs)) process.stdout.write(readFileSync(logs));
      return 0;
    }
    case 'startup':
      mkdirSync(join(STUB_STATE, 'systemd'), { recursive: true });
      writeFileSync(
        join(STUB_STATE, 'systemd', `pm2-${option('-u')}.service`),
        'pm2 resurrect\n',
      );
      return 0;
    default:
      return 0;
  }
}

function curl() {
  let output;
  let url;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') output = args[++i];
    else if (!args[i].startsWith('-')) url = args[i];
  }
  const source = join(
    process.env.STUB_FILES ?? '',
    basename(new URL(url).pathname),
  );
  if (!existsSync(source)) {
    console.error(`curl: (22) The requested URL returned error: 404`);
    return 22;
  }
  copyFileSync(source, output);
  return 0;
}

function main() {
  switch (name) {
    case 'sudo': {
      const command = args[0] === '-n' ? args.slice(1) : args;
      const result = spawnSync(command[0], command.slice(1), {
        stdio: 'inherit',
      });
      return result.status ?? 1;
    }
    case 'pm2':
      return pm2();
    case 'systemctl':
      if (args[0] === 'is-enabled') {
        return existsSync(join(STUB_STATE, 'systemd', args.at(-1))) ? 0 : 1;
      }
      return 0;
    case 'curl':
      return curl();
    case 'apt-get':
      // o pacote põe o binário onde o bootstrap procura
      if (args.includes('logrotate')) {
        writeFileSync(process.env.AO_UERJ_LOGROTATE, shortcut('logrotate'));
        chmodSync(process.env.AO_UERJ_LOGROTATE, 0o755);
      }
      return 0;
    case 'npm': {
      const corepack = args.find(arg => arg.startsWith('corepack@'));
      if (corepack) {
        writeFileSync(process.env.STUB_COREPACK_FILE, corepack.split('@')[1]);
      }
      return 0;
    }
    default:
      // nginx, logrotate, corepack: só registram
      return 0;
  }
}

if (executed) {
  record();
  const rule = failure();
  if (rule) {
    if (rule.stdout) process.stdout.write(rule.stdout);
    process.exit(rule.exit ?? 1);
  }
  process.exit(main());
}
