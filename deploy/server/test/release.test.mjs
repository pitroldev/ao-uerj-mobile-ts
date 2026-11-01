/*
 * release.sh: o azul/verde. O release desempacotado tem um smoke.mjs de
 * mentira (SMOKE_FAIL=direct|nginx decide onde ele falha), e o nginx, o pm2
 * e o corepack são os do stub.mjs.
 */
import assert from 'node:assert/strict';
import { existsSync, readlinkSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  FAKE_SMOKE,
  SCRIPTS,
  app,
  put,
  read,
  sandbox,
  unsupported,
  upstream,
} from './support.mjs';

const SHA = 'c0ffee'.padEnd(40, '1');
const LIVE_SHA = 'beef'.padEnd(40, '2');
const PORTS = { blue: 3101, green: 3102 };
const INCLUDE = '    include snippets/ao-uerj-proxy.conf;\n';

/**
 * A VM com `live` no ar (a porta do upstream) e o estado dizendo `recorded`.
 * `switched`: o cutover já foi feito (o site inclui o snippet).
 */
function vm(t, { live = 'blue', recorded = live, switched = true } = {}) {
  const box = sandbox(t);
  const release = join(box.root, 'releases', SHA);
  put(join(release, 'server', 'package.json'), '{}\n');
  put(join(release, 'deploy', 'server', 'smoke.mjs'), FAKE_SMOKE);
  put(join(box.root, 'shared', '.env'), 'NODE_ENV=production\n');
  const state = join(box.root, 'state');
  if (recorded !== 'none') {
    put(join(state, 'active'), `${recorded}\n`);
    put(join(state, `${recorded}.sha`), `${LIVE_SHA}\n`);
    put(
      join(state, 'history'),
      `2026-10-31T10:00:00Z ${LIVE_SHA} ${recorded}\n`,
    );
  }
  const upstreamFile = join(
    box.etc,
    'nginx',
    'conf.d',
    'ao-uerj-upstream.conf',
  );
  put(upstreamFile, upstream(PORTS[live] ?? PORTS.blue));
  put(
    join(box.etc, 'nginx', 'sites-enabled', 'default'),
    `server {\n  location /aouerj/ {\n${switched ? INCLUDE : '    proxy_pass http://localhost:3000/aouerj/;\n'}  }\n}\n`,
  );
  if (live !== 'none') box.apps([app(`ao-uerj-${live}`), app('uerj-twitter')]);
  return {
    ...box,
    release,
    state,
    upstreamFile,
    deploy: (env = {}) => box.run(join(SCRIPTS, 'release.sh'), [SHA], { env }),
    /** A ordem dos comandos que mexem na VM. */
    steps: () =>
      box
        .calls()
        .filter(call => call.cmd !== 'sudo')
        .map(call => `${call.cmd} ${call.args.join(' ')}`.trim()),
    stateOf: name =>
      existsSync(join(state, name)) ? read(join(state, name)) : null,
  };
}

const direct = port => [
  `http://127.0.0.1:${port}`,
  '--wait',
  '60',
  '--require-database',
  '--expect-commit',
  SHA,
];
const throughNginx = [
  'https://pitrol.dev',
  '--via',
  '127.0.0.1',
  '--require-database',
  '--expect-commit',
  SHA,
];

describe('release.sh', { skip: unsupported }, () => {
  test('a release goes up on the idle color, is checked and takes the traffic', async t => {
    const box = vm(t);
    const { code, stdout } = await box.deploy();
    assert.equal(code, 0, stdout);
    assert.match(stdout, /traffic=switched\n$/);

    // a ordem: instala, sobe ao lado, confere, troca, confere pelo nginx,
    // grava, e só então a anterior sai
    assert.deepEqual(box.steps(), [
      'corepack pnpm install --prod --frozen-lockfile --ignore-workspace --reporter=append-only',
      'pm2 delete ao-uerj-green',
      `pm2 start ${box.release}/server/src/main.ts --name ao-uerj-green --cwd ${box.release}/server --interpreter ${box.root}/node/bin/node --node-args=--env-file-if-exists=.env --kill-timeout 15000 --max-memory-restart 400M --time`,
      `smoke ${direct(3102).join(' ')}`,
      'nginx -t -q',
      'systemctl reload nginx',
      `smoke ${throughNginx.join(' ')}`,
      'pm2 save --force',
      'pm2 delete ao-uerj-blue',
      'pm2 save --force',
    ]);
    const [install] = box.calls('corepack');
    assert.equal(install.cwd, join(box.release, 'server'));
    const start = box.calls('pm2').find(call => call.args[0] === 'start');
    assert.deepEqual(start.env, {
      PORT: '3102',
      HOST: '127.0.0.1',
      RELEASE_COMMIT: SHA,
      RELEASE_COLOR: 'green',
    });

    assert.equal(read(box.upstreamFile), upstream(3102));
    assert.equal(box.stateOf('active'), 'green\n');
    assert.equal(box.stateOf('green.sha'), `${SHA}\n`);
    assert.match(
      box.stateOf('history'),
      new RegExp(`\\n\\S+Z ${SHA} green\\n$`),
    );
    // gravado de uma vez: nenhum arquivo provisório fica para trás
    assert.deepEqual(
      box.files(box.state).filter(name => name.startsWith('.')),
      [],
    );
    assert.equal(
      readlinkSync(join(box.release, 'server', '.env')),
      join(box.root, 'shared', '.env'),
    );
    assert.deepEqual(
      box.apps().map(entry => entry.name),
      ['uerj-twitter', 'ao-uerj-green'],
    );
  });

  test('the nginx, not the state, says which color is live', async t => {
    // o estado ficou para trás dizendo azul, mas o nginx serve a verde
    const box = vm(t, { live: 'green', recorded: 'blue' });
    const { code, stdout } = await box.deploy();
    assert.equal(code, 0);
    assert.match(
      stdout,
      /o estado dizia blue, mas o nginx serve green: vale o nginx/,
    );
    const start = box.calls('pm2').find(call => call.args[0] === 'start');
    assert.equal(start.env.PORT, '3101');
    assert.equal(read(box.upstreamFile), upstream(3101));
    assert.equal(box.stateOf('active'), 'blue\n');
  });

  test('a release that fails the smoke keeps the live color', async t => {
    const box = vm(t);
    const { code, stdout } = await box.deploy({ SMOKE_FAIL: 'direct' });
    assert.equal(code, 1);
    assert.match(
      stdout,
      /a versão nova não passou na conferência; a versão no ar continua sendo a blue/,
    );
    assert.doesNotMatch(stdout, /traffic=/);
    assert.equal(read(box.upstreamFile), upstream(3101));
    assert.deepEqual(box.calls('nginx'), []);
    assert.equal(box.steps().at(-1), 'pm2 delete ao-uerj-green');
    assert.equal(box.stateOf('active'), 'blue\n');
    assert.equal(box.stateOf('green.sha'), null);
    assert.deepEqual(
      box.apps().map(entry => entry.name),
      ['ao-uerj-blue', 'uerj-twitter'],
    );
  });

  test('a failed install or a process that does not start keeps the live color', async t => {
    const install = vm(t);
    install.rules.push({ cmd: 'corepack' });
    const installed = await install.deploy();
    assert.equal(installed.code, 1);
    assert.match(
      installed.stdout,
      /a instalação falhou; a versão no ar continua sendo a blue/,
    );
    assert.equal(
      install.calls('pm2').some(call => call.args[0] === 'start'),
      false,
    );

    const start = vm(t);
    start.rules.push({ cmd: 'pm2', match: 'start' });
    const started = await start.deploy();
    assert.equal(started.code, 1);
    assert.match(started.stdout, /o pm2 não subiu o processo/);
    assert.deepEqual(start.calls('smoke'), []);
    assert.equal(start.stateOf('active'), 'blue\n');
  });

  test('before the cutover a release runs without traffic and leaves the nginx alone', async t => {
    const first = vm(t, { live: 'none', recorded: 'none', switched: false });
    const { code, stdout } = await first.deploy();
    assert.equal(code, 0);
    assert.match(stdout, /ainda sem tráfego: falta o cutover\.sh/);
    assert.match(stdout, /traffic=pending\n$/);
    assert.deepEqual(first.calls('nginx'), []);
    assert.deepEqual(
      first.calls('smoke').map(call => call.args),
      [direct(3101)],
    );
    assert.equal(read(first.upstreamFile), upstream(3101));
    assert.equal(first.stateOf('active'), 'blue\n');

    // a seguinte vai para a outra cor e tira a anterior do pm2
    const second = vm(t, { recorded: 'blue', switched: false });
    const next = await second.deploy();
    assert.match(next.stdout, /traffic=pending\n$/);
    assert.equal(second.stateOf('active'), 'green\n');
    assert.ok(second.steps().includes('pm2 delete ao-uerj-blue'));
    assert.equal(read(second.upstreamFile), upstream(3101));
  });

  test('a release that fails behind the nginx puts the previous color back', async t => {
    const box = vm(t);
    const { code, stdout } = await box.deploy({ SMOKE_FAIL: 'nginx' });
    assert.equal(code, 1);
    assert.match(
      stdout,
      /a versão nova falhou pelo nginx; o nginx voltou para a blue/,
    );
    assert.equal(read(box.upstreamFile), upstream(3101));
    assert.equal(box.calls('systemctl').length, 2);
    assert.equal(box.steps().at(-1), 'pm2 delete ao-uerj-green');
    assert.equal(box.stateOf('active'), 'blue\n');
    assert.doesNotMatch(stdout, /traffic=/);
  });

  test('a switch the nginx refuses is undone before anything else', async t => {
    const box = vm(t);
    box.rules.push({ cmd: 'nginx', match: '-t', calls: [1] });
    const { code, stdout } = await box.deploy();
    assert.equal(code, 1);
    assert.match(stdout, /o nginx recusou a troca; o nginx voltou para a blue/);
    assert.equal(read(box.upstreamFile), upstream(3101));
    assert.deepEqual(
      box.calls('smoke').map(call => call.args),
      [direct(3102)],
    );
  });

  test('when the nginx cannot go back, the new color keeps running', async t => {
    const box = vm(t);
    // a troca recarrega; a volta não
    box.rules.push({ cmd: 'systemctl', match: 'reload', calls: [2] });
    const { code, stdout } = await box.deploy({ SMOKE_FAIL: 'nginx' });
    assert.equal(code, 1);
    assert.match(
      stdout,
      /o nginx NÃO voltou para a blue, então a green continua rodando/,
    );
    const deletes = box
      .calls('pm2')
      .filter(call => call.args[0] === 'delete')
      .map(call => call.args[1]);
    // só a limpeza antes de subir: a verde não sai
    assert.deepEqual(deletes, ['ao-uerj-green']);
    assert.ok(box.apps().some(entry => entry.name === 'ao-uerj-green'));
    assert.equal(box.stateOf('active'), 'blue\n');
  });

  test('only the five newest releases stay, the deployed one always among them', async t => {
    const box = vm(t);
    const old = Date.now() / 1000 - 86_400;
    const others = Array.from({ length: 6 }, (_, i) => `${i}`.repeat(40));
    others.forEach((sha, i) => {
      put(join(box.root, 'releases', sha, 'server', 'package.json'), '{}\n');
      utimesSync(join(box.root, 'releases', sha), old + 10 + i, old + 10 + i);
    });
    // uma volta a uma versão antiga: a pasta dela é a mais velha de todas
    utimesSync(box.release, old, old);
    const { code } = await box.deploy();
    assert.equal(code, 0);
    assert.deepEqual(
      box.files(join(box.root, 'releases')),
      [...others.slice(2), SHA].sort(),
    );
  });

  test('the log of a failed release shows levels, messages and error classes only', async t => {
    const box = vm(t);
    put(
      join(box.stubState, 'pm2-logs.txt'),
      [
        '2026-11-01T13:58:31: {"level":30,"msg":"listening","port":3102}',
        '2026-11-01T13:58:32: {"level":50,"msg":"database connection failed","err":{"type":"MongoServerSelectionError","message":"connect ECONNREFUSED mongodb://ao:segredo@db.example:27017","stack":"MongoServerSelectionError: at /home/ubuntu/ao-uerj-server"}}',
        'MongoParseError: Invalid scheme in mongodb://ao:segredo@db.example',
        '    at Object.<anonymous> (/home/ubuntu/ao-uerj-server/releases/x/server/src/main.ts:1:1)',
        '',
      ].join('\n'),
    );
    const { code, stdout } = await box.deploy({ SMOKE_FAIL: 'direct' });
    assert.equal(code, 1);
    const lines = stdout.split('\n').filter(line => line.startsWith('  log:'));
    assert.deepEqual(lines, [
      '  log: 30 listening',
      '  log: 50 database connection failed MongoServerSelectionError',
      '  log: (fora do JSON) MongoParseError',
    ]);
    // o repositório é público: nada do texto dos erros chega ao CI
    assert.doesNotMatch(
      stdout,
      /segredo|mongodb:\/\/|ECONNREFUSED|\/home\/ubuntu/,
    );
  });
});
