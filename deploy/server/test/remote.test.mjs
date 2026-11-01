/*
 * remote.sh: o que a chave do CI pode pedir na VM. Os commits são de um
 * repositório de verdade (o "GitHub" é uma pasta) e trazem um release.sh de
 * mentira, que diz quem é e termina como o de verdade.
 */
import assert from 'node:assert/strict';
import { existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  SCRIPTS,
  app,
  commit,
  git,
  put,
  read,
  sandbox,
  unsupported,
  waitFor,
} from './support.mjs';

const FAKE_RELEASE = `#!/usr/bin/env bash
# release.sh de mentira (deploy/server/test/remote.test.mjs)
set -euo pipefail
echo "release $1 começou"
[ -z "\${RELEASE_SLEEP:-}" ] || sleep "$RELEASE_SLEEP"
echo "release $1 terminou"
echo traffic=switched
touch "$HOME/release-$1.done"
exit "\${RELEASE_EXIT:-0}"
`;

/** A VM com o clone do repositório: c1 e c2 na main, c3 num ramo à parte. */
function vm(t) {
  const box = sandbox(t);
  const origin = join(box.dir, 'origin');
  git(box.dir, 'init', '-q', '-b', 'main', origin);
  const c1 = commit(origin, {
    'server/README.md': 'v1\n',
    'deploy/server/release.sh': FAKE_RELEASE,
  });
  const c2 = commit(origin, { 'server/README.md': 'v2\n' });
  git(origin, 'checkout', '-q', '-b', 'side');
  const c3 = commit(origin, { 'server/README.md': 'fora da main\n' });
  git(origin, 'checkout', '-q', 'main');
  git(box.dir, 'clone', '-q', '--bare', origin, join(box.root, 'repo.git'));
  const state = join(box.root, 'state');
  return {
    ...box,
    c1,
    c2,
    c3,
    state,
    logs: join(state, 'logs'),
    /** A versão no ar, como a implantação grava. */
    live(color, sha, history = []) {
      put(join(state, 'active'), `${color}\n`);
      put(join(state, `${color}.sha`), `${sha}\n`);
      if (history.length)
        put(join(state, 'history'), history.join('\n') + '\n');
    },
    start(command, options = {}) {
      return box.start(join(SCRIPTS, 'remote.sh'), [], {
        ...options,
        env: { SSH_ORIGINAL_COMMAND: command, ...options.env },
      });
    },
    remote(command, options) {
      return this.start(command, options).done;
    },
    done: sha => existsSync(join(box.home, `release-${sha}.done`)),
  };
}

describe('remote.sh', { skip: unsupported }, () => {
  test('a malformed request is refused before anything runs', async t => {
    const box = vm(t);
    const usage = 'uso: deploy <sha> | rollback | status';
    for (const [command, message] of [
      ['', usage],
      ['reboot', usage],
      ['deploy', 'uso: deploy <sha de 40 caracteres>'],
      ['deploy abc123', 'uso: deploy <sha de 40 caracteres>'],
      [`deploy ${box.c2.toUpperCase()}`, 'uso: deploy <sha de 40 caracteres>'],
      [`deploy ${box.c2} --force`, 'argumentos demais'],
      ['status now please', 'argumentos demais'],
    ]) {
      const { code, output } = await box.remote(command);
      assert.equal(code, 64, `"${command}"`);
      assert.match(output, new RegExp(message.replace(/[|<>]/g, '.')));
    }
    assert.deepEqual(box.files(join(box.root, 'releases')), []);
  });

  test('only a commit of the main branch is deployed', async t => {
    const box = vm(t);
    for (const sha of [box.c3, 'f'.repeat(40)]) {
      const { code, output } = await box.remote(`deploy ${sha}`);
      assert.equal(code, 65);
      assert.match(output, new RegExp(`${sha} não está na main`));
    }
    assert.equal(box.done(box.c3), false);
  });

  test('a commit older than the live one goes only through the rollback', async t => {
    const box = vm(t);
    box.live('blue', box.c2);
    const { code, output } = await box.remote(`deploy ${box.c1}`);
    assert.equal(code, 65);
    assert.match(output, /é mais antigo que o no ar/);
    assert.match(output, /use o rollback/);
    assert.equal(box.done(box.c1), false);
  });

  test('a deploy runs the release of the unpacked commit and passes its whole output on', async t => {
    const box = vm(t);
    box.live('blue', box.c1);
    const { code, stdout } = await box.remote(`deploy ${box.c2}`);
    assert.equal(code, 0);
    assert.equal(
      stdout,
      `release ${box.c2} começou\nrelease ${box.c2} terminou\ntraffic=switched\n`,
    );
    // só server/ e deploy/ do commit, sem a pasta provisória
    const release = join(box.root, 'releases', box.c2);
    assert.equal(read(join(release, 'server', 'README.md')), 'v2\n');
    assert.ok(existsSync(join(release, 'deploy', 'server', 'release.sh')));
    assert.deepEqual(box.files(join(box.root, 'releases')), [box.c2]);
    // o log da implantação, inteiro, fica na VM
    const [log] = box.files(box.logs);
    assert.match(
      log,
      new RegExp(`^\\d{8}T\\d{6}Z-${box.c2.slice(0, 7)}\\.log$`),
    );
    assert.equal(read(join(box.logs, log)), stdout);
  });

  test('deploying the live commit again is allowed', async t => {
    const box = vm(t);
    box.live('blue', box.c2);
    const { code, stdout } = await box.remote(`deploy ${box.c2}`);
    assert.equal(code, 0);
    assert.match(stdout, /traffic=switched/);
  });

  test('a state without the live commit does not block a deploy', async t => {
    const box = vm(t);
    // a cor ativa sem o sha dela (um passo que morreu no meio)
    put(join(box.state, 'active'), 'green\n');
    const { code, stdout } = await box.remote(`deploy ${box.c1}`);
    assert.equal(code, 0);
    assert.match(stdout, /traffic=switched/);
  });

  test('a release that fails makes the request fail with its code', async t => {
    const box = vm(t);
    const { code, stdout } = await box.remote(`deploy ${box.c2}`, {
      env: { RELEASE_EXIT: '3' },
    });
    assert.equal(code, 3);
    assert.match(stdout, /release .* terminou/);
  });

  test('a dropped channel does not stop the release, which writes its whole log', async t => {
    const box = vm(t);
    // o ssh caindo: o grupo de processos do remote.sh (com o tail) morre
    const run = box.start(`deploy ${box.c2}`, {
      detached: true,
      env: { RELEASE_SLEEP: '2' },
    });
    await waitFor(
      () => run.stdout().includes('começou'),
      'a implantação começar',
    );
    process.kill(-run.child.pid, 'SIGKILL');
    const { signal } = await run.done;
    assert.equal(signal, 'SIGKILL');

    await waitFor(() => box.done(box.c2), 'a implantação terminar sozinha');
    const [log] = box.files(box.logs);
    await waitFor(
      () => read(join(box.logs, log)).includes('traffic=switched'),
      'o fim do log',
    );
    assert.match(read(join(box.logs, log)), /terminou\ntraffic=switched\n$/);
  });

  test('a second request waits for the release that holds the lock', async t => {
    const box = vm(t);
    const deploy = box.start(`deploy ${box.c2}`, {
      env: { RELEASE_SLEEP: '2' },
    });
    await waitFor(() => deploy.stdout().includes('começou'), 'a implantação');
    const status = await box.remote('status');
    // o status só passou da trava com a implantação terminada
    assert.equal(box.done(box.c2), true);
    assert.equal(status.code, 0);
    assert.equal((await deploy.done).code, 0);
  });

  test('only the 30 newest deploy logs are kept', async t => {
    const box = vm(t);
    const old = Date.now() / 1000 - 86_400;
    for (let i = 0; i < 32; i++) {
      const name = join(
        box.logs,
        `20261001T0000${String(i).padStart(2, '0')}Z-0000000.log`,
      );
      put(name, 'antigo\n');
      utimesSync(name, old + i, old + i);
    }
    const { code } = await box.remote(`deploy ${box.c2}`);
    assert.equal(code, 0);
    const kept = box.files(box.logs);
    assert.equal(kept.length, 30);
    assert.ok(kept.some(name => name.endsWith(`-${box.c2.slice(0, 7)}.log`)));
    // os mais antigos saíram
    assert.ok(!kept.includes('20261001T000000Z-0000000.log'));
    assert.ok(!kept.includes('20261001T000002Z-0000000.log'));
    assert.ok(kept.includes('20261001T000003Z-0000000.log'));
  });

  test('the rollback goes back to the previous version in the history', async t => {
    const box = vm(t);
    box.live('green', box.c2, [
      `2026-10-30T10:00:00Z ${box.c1} blue`,
      `2026-10-31T10:00:00Z ${box.c2} green`,
    ]);
    const { code, stdout } = await box.remote('rollback');
    assert.equal(code, 0);
    assert.match(stdout, new RegExp(`voltando de ${box.c2} para ${box.c1}`));
    assert.match(stdout, new RegExp(`release ${box.c1} terminou`));
    assert.ok(existsSync(join(box.root, 'releases', box.c1, 'server')));
  });

  test('without a previous version there is nothing to roll back to', async t => {
    for (const history of [[], ['2026-10-31T10:00:00Z SHA green']]) {
      const box = vm(t);
      box.live(
        'green',
        box.c2,
        history.map(line => line.replace('SHA', box.c2)),
      );
      const { code, output } = await box.remote('rollback');
      assert.equal(code, 66);
      assert.match(output, /não há versão anterior/);
    }
  });

  test('the status shows the colors, the recent history and only this server processes', async t => {
    const box = vm(t);
    const history = Array.from(
      { length: 6 },
      (_, i) =>
        `2026-10-2${i}T10:00:00Z ${i % 2 ? box.c2 : box.c1} ${i % 2 ? 'green' : 'blue'}`,
    );
    box.live('green', box.c2, history);
    put(join(box.state, 'blue.sha'), `${box.c1}\n`);
    box.apps([
      app('ao-uerj', { status: 'stopped', memory: 10e6 }),
      app('ao-uerj-blue', { memory: 61e6 }),
      app('ao-uerj-green', { memory: 72e6 }),
      app('uerj-twitter'),
      app('ao-uerj-old'),
    ]);
    const { code, stdout } = await box.remote('status');
    assert.equal(code, 0);
    assert.equal(
      stdout,
      [
        'ativa: green',
        `blue: ${box.c1}`,
        `green: ${box.c2}`,
        ...history.slice(1),
        'ao-uerj stopped 10 MB',
        'ao-uerj-blue online 61 MB',
        'ao-uerj-green online 72 MB',
        '',
      ].join('\n'),
    );
  });

  test('the status of a VM without deploys says so', async t => {
    const box = vm(t);
    const { code, stdout } = await box.remote('status');
    assert.equal(code, 0);
    assert.equal(stdout, 'ativa: nenhuma\n');
  });
});
