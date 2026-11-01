/*
 * bootstrap.sh: o preparo da VM. O Node "baixado" é um tar.xz de mentira (com
 * o SHASUMS256 de verdade dele), o repositório é uma pasta e o servidor
 * antigo é um .env com o MONGODB_URI.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { shortcut } from './stub.mjs';
import {
  SCRIPTS,
  USER,
  commit,
  git,
  modeOf,
  put,
  read,
  sandbox,
  unsupported,
} from './support.mjs';

const KEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyForTheDeployTestsOnly0000000000 ci@teste';
const TARBALL = 'node-v22.21.1-linux-x64.tar.xz';

function vm(t, { checksum } = {}) {
  const box = sandbox(t);
  const downloads = join(box.dir, 'downloads');
  // o Node 22 de mentira: node -v, um corepack velho e o npm que o atualiza
  const dist = join(box.dir, 'dist', 'node-v22.21.1-linux-x64', 'bin');
  put(
    join(dist, 'node'),
    `#!/bin/sh\n[ "$1" = -v ] && { echo v22.21.1; exit 0; }\nexec "${process.execPath}" "$@"\n`,
    0o755,
  );
  const corepackVersion = join(box.root, 'node', 'corepack-version');
  put(
    join(dist, 'corepack'),
    `#!/bin/sh\ncat "${corepackVersion}" 2>/dev/null || echo 0.34.0\n`,
    0o755,
  );
  put(join(dist, 'npm'), shortcut('npm'), 0o755);
  mkdirSync(downloads, { recursive: true });
  const packed = spawnSync('tar', [
    '-cJf',
    join(downloads, TARBALL),
    '-C',
    join(box.dir, 'dist'),
    'node-v22.21.1-linux-x64',
  ]);
  assert.equal(packed.status, 0, String(packed.stderr));
  const sum =
    checksum ??
    createHash('sha256')
      .update(readFileSync(join(downloads, TARBALL)))
      .digest('hex');
  put(
    join(downloads, 'SHASUMS256.txt'),
    `${'0'.repeat(64)}  node-v22.21.1-linux-arm64.tar.xz\n${sum}  ${TARBALL}\n`,
  );

  const origin = join(box.dir, 'origin');
  git(box.dir, 'init', '-q', '-b', 'main', origin);
  const head = commit(origin, { 'README.md': 'ao-uerj\n' });

  const legacy = join(box.home, 'server-pitroldev');
  put(
    join(legacy, '.env'),
    'PORT=3000\nMONGODB_URI=mongodb://legado.example/aouerj\nOUTRA=1\n',
  );
  put(join(legacy, 'AOreports', 'Home-1.html'), 'anexo\n');
  mkdirSync(join(box.etc, 'nginx', 'conf.d'), { recursive: true });
  mkdirSync(join(box.etc, 'logrotate.d'), { recursive: true });
  const logrotate = join(box.dir, 'sbin', 'logrotate');
  mkdirSync(join(box.dir, 'sbin'), { recursive: true });

  return {
    ...box,
    head,
    legacy,
    logrotate,
    corepackVersion,
    env: join(box.root, 'shared', '.env'),
    reports: join(box.root, 'shared', 'AOreports'),
    upstreamFile: join(box.etc, 'nginx', 'conf.d', 'ao-uerj-upstream.conf'),
    rotate: join(box.etc, 'logrotate.d', `pm2-${USER}`),
    keys: join(box.home, '.ssh', 'authorized_keys'),
    bootstrap: (args = [KEY]) =>
      box.run(join(SCRIPTS, 'bootstrap.sh'), args, {
        env: {
          AO_UERJ_REPO: origin,
          AO_UERJ_LOGROTATE: logrotate,
          STUB_FILES: downloads,
          STUB_COREPACK_FILE: corepackVersion,
        },
      }),
    /** Quantas vezes cada comando foi chamado até agora. */
    counts() {
      const counts = {};
      for (const call of box.calls()) {
        const key = `${call.cmd} ${call.args[0] ?? ''}`.trim();
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  };
}

describe('bootstrap.sh', { skip: unsupported }, () => {
  test('the first bootstrap prepares the whole tree', async t => {
    const box = vm(t);
    const { code, stdout, output } = await box.bootstrap();
    assert.equal(code, 0, output);
    for (const step of [
      'baixando o Node v22.21.1',
      'node v22.21.1',
      'instalando o Corepack 0.34.7',
      'clonando o repositório',
      'copiando os anexos dos relatos',
      'criando shared/.env',
      'sem uso até o cutover',
      'ligando o pm2 no boot',
      'instalando o logrotate',
      'girando os logs do pm2',
      'autorizando a chave do CI',
      'pronto',
    ]) {
      assert.match(stdout, new RegExp(`\\[bootstrap\\] .*${step}`), step);
    }

    // o Node conferido pelo SHASUMS e o Corepack que roda o pnpm 12
    assert.ok(existsSync(join(box.root, 'node', 'bin', 'node')));
    assert.equal(read(box.corepackVersion), '0.34.7');
    const [npm] = box.calls('npm');
    assert.deepEqual(npm.args.slice(0, 2), ['install', '--global']);
    assert.equal(npm.args.at(-1), 'corepack@0.34.7');

    // o clone só da história
    const repo = join(box.root, 'repo.git');
    assert.equal(git(repo, 'rev-parse', '--is-bare-repository'), 'true');
    assert.equal(git(repo, 'rev-parse', 'main'), box.head);

    // a configuração de produção: só o MONGODB_URI vem do servidor antigo
    const env = read(box.env).split('\n');
    assert.deepEqual(env.slice(0, 4), [
      'NODE_ENV=production',
      'HOST=127.0.0.1',
      'MONGODB_URI=mongodb://legado.example/aouerj',
      'TRUST_PROXY=1',
    ]);
    assert.ok(env.includes(`REPORTS_DIR=${box.reports}`));
    assert.match(
      env.find(line => line.startsWith('ADMIN_TOKEN=')),
      /^ADMIN_TOKEN=[0-9a-f]{48}$/,
    );
    assert.ok(env.includes('PORTAL_MONITOR=on'));
    assert.ok(!env.includes('PORT=3000'));
    assert.equal(modeOf(box.env), 0o600);
    // os anexos têm dados pessoais
    assert.equal(modeOf(box.reports), 0o700);
    assert.equal(read(join(box.reports, 'Home-1.html')), 'anexo\n');

    assert.equal(
      read(box.upstreamFile),
      'upstream ao_uerj_server {\n  server 127.0.0.1:3101;\n}\n',
    );
    const startup = box.calls('pm2').find(call => call.args[0] === 'startup');
    assert.deepEqual(startup.args, [
      'startup',
      'systemd',
      '-u',
      USER,
      '--hp',
      box.home,
    ]);
    assert.ok(
      box.calls('pm2').some(call => call.args.join(' ') === 'save --force'),
    );

    // o logrotate instalado e a configuração conferida por ele
    assert.ok(
      box.calls('apt-get').some(call => call.args.includes('logrotate')),
    );
    const rotate = read(box.rotate);
    assert.match(
      rotate,
      new RegExp(
        `^${box.home}/\\.pm2/pm2\\.log ${box.home}/\\.pm2/logs/\\*\\.log \\{\\n`,
      ),
    );
    for (const line of [
      `su ${USER} ${USER}`,
      'daily',
      'rotate 14',
      'compress',
      'copytruncate',
    ]) {
      assert.match(rotate, new RegExp(`\\n  ${line}\\n`));
    }
    assert.deepEqual(box.calls('logrotate')[0].args, ['--debug', box.rotate]);

    // a chave do CI só roda o bin/remote
    assert.equal(
      read(join(box.root, 'bin', 'remote')),
      read(join(SCRIPTS, 'remote.sh')),
    );
    assert.equal(modeOf(join(box.root, 'bin', 'remote')), 0o755);
    assert.equal(
      read(box.keys),
      `command="${box.root}/bin/remote",restrict ${KEY}\n`,
    );
    assert.equal(modeOf(box.keys), 0o600);
    assert.equal(modeOf(join(box.home, '.ssh')), 0o700);
  });

  test('a second bootstrap changes nothing, and copies only new attachments', async t => {
    const box = vm(t);
    assert.equal((await box.bootstrap()).code, 0);
    const env = read(box.env);
    const before = box.counts();
    put(join(box.reports, 'Home-1.html'), 'editado na VM\n');
    put(join(box.legacy, 'AOreports', 'Notas-2.html'), 'novo\n');

    const { code, stdout } = await box.bootstrap();
    assert.equal(code, 0);
    assert.deepEqual(stdout.trim().split('\n'), [
      '[bootstrap] node v22.21.1',
      '[bootstrap] copiando os anexos dos relatos (sem sobrescrever)',
      '[bootstrap] pronto',
    ]);
    // nada baixado, instalado, clonado, reescrito ou ligado de novo
    const after = box.counts();
    for (const command of [
      'curl -fsSL',
      'npm install',
      'apt-get install',
      'pm2 startup',
      'pm2 save',
      'logrotate --debug',
      'nginx -t',
    ]) {
      assert.equal(after[command], before[command], command);
    }
    assert.equal(read(box.env), env);
    assert.equal(read(box.keys).split('\n').filter(Boolean).length, 1);
    assert.equal(read(join(box.reports, 'Home-1.html')), 'editado na VM\n');
    assert.equal(read(join(box.reports, 'Notas-2.html')), 'novo\n');
    assert.equal(modeOf(box.reports), 0o700);
  });

  test('a logrotate already on the VM is not installed again', async t => {
    const box = vm(t);
    put(box.logrotate, shortcut('logrotate'), 0o755);
    const { code, stdout } = await box.bootstrap();
    assert.equal(code, 0);
    assert.doesNotMatch(stdout, /instalando o logrotate/);
    assert.deepEqual(box.calls('apt-get'), []);
    assert.ok(existsSync(box.rotate));
  });

  test('a configuration the logrotate refuses is removed', async t => {
    const box = vm(t);
    box.rules.push({ cmd: 'logrotate' });
    const { code, output } = await box.bootstrap();
    assert.equal(code, 1);
    assert.match(output, /o logrotate recusou a configuração/);
    assert.equal(existsSync(box.rotate), false);
  });

  test('only an ssh-ed25519 key is authorized', async t => {
    const box = vm(t);
    const rsa = await box.bootstrap([
      'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ ci@teste',
    ]);
    assert.equal(rsa.code, 64);
    assert.match(rsa.output, /a chave precisa ser ssh-ed25519/);
    const missing = await box.bootstrap([]);
    assert.notEqual(missing.code, 0);
    assert.match(missing.output, /uso: bootstrap\.sh/);
    // recusado antes de criar qualquer coisa
    assert.equal(existsSync(box.root), false);
    assert.equal(existsSync(box.keys), false);
  });

  test('a Node download that does not match the SHASUMS is not installed', async t => {
    const box = vm(t, { checksum: 'f'.repeat(64) });
    const { code } = await box.bootstrap();
    assert.notEqual(code, 0);
    assert.equal(existsSync(join(box.root, 'node', 'bin', 'node')), false);
    assert.deepEqual(box.calls('npm'), []);
  });

  test('without the MONGODB_URI of the old server there is no production config', async t => {
    const box = vm(t);
    put(join(box.legacy, '.env'), 'PORT=3000\n');
    const { code, output } = await box.bootstrap();
    assert.equal(code, 1);
    assert.match(output, /sem MONGODB_URI/);
    assert.equal(existsSync(box.env), false);
  });
});
