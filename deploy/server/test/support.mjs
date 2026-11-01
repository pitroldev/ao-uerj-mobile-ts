/*
 * A caixa de areia dos testes dos scripts de implantação: um HOME, um /etc e
 * os comandos da VM (stub.mjs) numa pasta temporária. Os scripts rodam de
 * verdade, com bash, git, tar e coreutils; só o que mexeria na máquina (pm2,
 * nginx, systemd, sudo, rede) é de mentira.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { shortcut } from './stub.mjs';

/** deploy/server, onde estão os scripts. */
export const SCRIPTS = dirname(dirname(fileURLToPath(import.meta.url)));
export const USER = userInfo().username;

const COMMANDS = [
  'pm2',
  'sudo',
  'nginx',
  'systemctl',
  'corepack',
  'curl',
  'apt-get',
];

/** Os scripts rodam na VM (Linux): sem o bash e as ferramentas dela, pula. */
export const unsupported = (() => {
  if (process.platform === 'win32') return 'os scripts rodam no Linux da VM';
  const tools = ['bash', 'git', 'flock', 'setsid', 'tar', 'xz', 'sha256sum'];
  const missing = tools.filter(
    tool => spawnSync('sh', ['-c', `command -v ${tool}`]).status !== 0,
  );
  if (missing.length) return `faltam ${missing.join(', ')}`;
  // o remote.sh acompanha o log da implantação com o tail do GNU
  const tail = spawnSync('sh', ['-c', 'tail --pid=1 -n 0 /dev/null']);
  return tail.status === 0 ? false : 'o tail não tem --pid (coreutils do GNU)';
})();

/** Escreve um arquivo, criando as pastas. */
export function put(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mode !== undefined) chmodSync(path, mode);
}

export const read = path => readFileSync(path, 'utf8');
/** As permissões (rwx do dono, do grupo e dos outros), como 0o700. */
export const modeOf = path => statSync(path).mode % 0o1000;

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Teste',
  GIT_AUTHOR_EMAIL: 'teste@example.com',
  GIT_COMMITTER_NAME: 'Teste',
  GIT_COMMITTER_EMAIL: 'teste@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function git(cwd, ...args) {
  const result = spawnSync('git', args, {
    cwd,
    env: GIT_ENV,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/** Um commit com estes arquivos (caminho → conteúdo); devolve o sha. */
export function commit(repo, files, message = 'commit') {
  for (const [path, content] of Object.entries(files)) {
    put(join(repo, path), content);
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

/** Espera uma condição (polling), até o prazo. */
export async function waitFor(check, what, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await sleep(50);
  }
  throw new Error(`esperei demais: ${what}`);
}

/**
 * Uma caixa de areia nova, apagada no fim do teste. `rules` são as falhas do
 * stub.mjs (STUB_RULES) que o teste quer.
 */
export function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ao-deploy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const home = join(dir, 'home');
  const root = join(home, 'ao-uerj-server');
  const etc = join(dir, 'etc');
  const stubs = join(dir, 'stubs');
  const state = join(dir, 'stub-state');
  const log = join(dir, 'calls.jsonl');
  // o mktemp dos scripts também fica dentro da caixa de areia
  const temp = join(dir, 'tmp');
  for (const path of [home, etc, stubs, state, temp]) {
    mkdirSync(path, { recursive: true });
  }
  writeFileSync(log, '');
  for (const command of COMMANDS) {
    put(join(stubs, command), shortcut(command), 0o755);
  }

  const box = {
    dir,
    home,
    root,
    etc,
    /** O estado do stub.mjs (pm2.json, pm2-logs.txt, as unidades do systemd). */
    stubState: state,
    log,
    rules: [],
    env(extra = {}) {
      return {
        PATH: `${stubs}:${process.env.PATH}`,
        HOME: home,
        USER,
        LANG: 'C.UTF-8',
        TMPDIR: temp,
        STUB_LOG: log,
        STUB_STATE: state,
        STUB_RULES: JSON.stringify(box.rules),
        AO_UERJ_ETC: etc,
        ...extra,
      };
    },
    /** Começa um script; `done` resolve com o código e as saídas. */
    start(script, args = [], { env = {}, detached = false } = {}) {
      const child = spawn('bash', [script, ...args], {
        cwd: home,
        env: box.env(env),
        detached,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', chunk => (stdout += chunk));
      child.stderr.on('data', chunk => (stderr += chunk));
      const done = new Promise(resolve => {
        child.on('close', (code, signal) =>
          resolve({ code, signal, stdout, stderr, output: stdout + stderr }),
        );
      });
      return { child, done, stdout: () => stdout };
    },
    run(script, args, options) {
      return box.start(script, args, options).done;
    },
    /** As chamadas registradas pelo stub.mjs (de um comando, se dado). */
    calls(command) {
      return read(log)
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
        .filter(call => !command || call.cmd === command);
    },
    /** Os processos do pm2 de mentira. */
    apps(list) {
      const file = join(state, 'pm2.json');
      if (list) writeFileSync(file, JSON.stringify(list, null, 2));
      return existsSync(file) ? JSON.parse(read(file)) : [];
    },
    files(path) {
      return existsSync(path) ? readdirSync(path).sort() : [];
    },
  };
  return box;
}

/** Um processo do pm2 como o `pm2 jlist` mostra. */
export function app(
  name,
  { status = 'online', memory = 50e6, script, cwd } = {},
) {
  return {
    name,
    pm2_env: {
      status,
      pm_exec_path: script ?? `/apps/${name}/index.js`,
      pm_cwd: cwd ?? `/apps/${name}`,
    },
    monit: { memory },
  };
}

/** O upstream do nginx apontando para uma porta. */
export const upstream = port =>
  `upstream ao_uerj_server {\n  server 127.0.0.1:${port};\n}\n`;

/** Um smoke.mjs de mentira: registra a chamada e falha onde SMOKE_FAIL mandar. */
export const FAKE_SMOKE = `// smoke.mjs de mentira (deploy/server/test)
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.STUB_LOG, JSON.stringify({ cmd: 'smoke', args }) + '\\n');
const where = args[0].startsWith('https://') ? 'nginx' : 'direct';
process.exit((process.env.SMOKE_FAIL ?? '').split(',').includes(where) ? 1 : 0);
`;
