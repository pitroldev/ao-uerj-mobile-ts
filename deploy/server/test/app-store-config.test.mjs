import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// Executa os argumentos reais do deploy: o .env privado continua tendo prioridade.
test('deployment loads the App Store identity and honors private overrides', t => {
  const root = mkdtempSync(join(tmpdir(), 'ao-app-store-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'server');
  mkdirSync(cwd);
  mkdirSync(join(root, 'deploy', 'server'), { recursive: true });
  writeFileSync(
    join(root, 'deploy', 'server', 'app-store.env'),
    readFileSync(new URL('../app-store.env', import.meta.url)),
  );
  const release = readFileSync(
    new URL('../release.sh', import.meta.url),
    'utf8',
  );
  const args = /--node-args='([^']+)'/.exec(release)[1].split(' ');
  const env = { ...process.env };
  delete env.APPLE_APP_ATTEST_APP_ID;
  const load = () => {
    const result = spawnSync(
      process.execPath,
      [
        ...args,
        '-e',
        'process.stdout.write(JSON.stringify(process.env.APPLE_APP_ATTEST_APP_ID))',
      ],
      { cwd, env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  assert.equal(load(), '4L52AMB8J7.com.aouerjmobile');
  writeFileSync(
    join(cwd, '.env'),
    'APPLE_APP_ATTEST_APP_ID=ABCDE12345.com.other\n',
  );
  assert.equal(load(), 'ABCDE12345.com.other');
  writeFileSync(join(cwd, '.env'), 'APPLE_APP_ATTEST_APP_ID=\n');
  assert.equal(load(), '');
});
