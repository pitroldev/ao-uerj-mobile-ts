import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import net from 'node:net';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer, type Server } from '../src/composition.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';

/*
 * A conferência da implantação (deploy/server/smoke.mjs), rodada como o
 * release.sh e o CI rodam: um processo à parte, contra o servidor de verdade.
 */
const SMOKE = fileURLToPath(
  new URL('../../deploy/server/smoke.mjs', import.meta.url),
);
const COMMIT = '0123456789abcdef0123456789abcdef01234567';

function smoke(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    execFile(
      process.execPath,
      [SMOKE, ...args],
      { timeout: 60_000 },
      (error, stdout, stderr) => {
        const code = error
          ? typeof error.code === 'number'
            ? error.code
            : -1
          : 0;
        resolve({ code, output: `${stdout}${stderr}` });
      },
    );
  });
}

const opened: Server[] = [];

/** Um servidor com o banco em memória, ligado ou não. */
async function serve(port = 0) {
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const portal = createPortalWatch({ probe: async () => 302 });
  await portal.check();
  const server = createServer(
    testConfig({ RELEASE_COMMIT: COMMIT, RELEASE_COLOR: 'green' }),
    silentLogger,
    {
      database: db.database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal,
    },
  );
  opened.push(server);
  const address = await server.start(port);
  return {
    server,
    memory,
    db,
    base: `http://127.0.0.1:${address.port}`,
    port: address.port,
  };
}

let healthy: Awaited<ReturnType<typeof serve>>;

before(async () => {
  healthy = await serve();
});

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

test('the smoke passes against a healthy server, checks the commit and writes nothing', async () => {
  const { code, output } = await smoke([
    healthy.base,
    '--require-database',
    '--expect-commit',
    COMMIT,
  ]);
  assert.equal(code, 0, output);
  assert.match(output, /tudo certo/);
  // as doze conferências, com o banco
  assert.equal(output.match(/^ {2}ok {2}/gm)?.length, 12, output);
  assert.match(
    output,
    /ok {2}GET \/aouerj\/v2\/tokens\/challenge \(emissão desligada\)/,
  );
  assert.match(output, /ok {2}GET \/aouerj\/status \(0123456 green\)/);
  // só lê: nada chegou ao mural, aos relatos nem às sugestões
  const { messages, reports, suggestions } = healthy.memory.data;
  assert.deepEqual([messages, reports, suggestions], [[], [], []]);
});

test('another commit in the air fails the smoke, saying which one answers', async () => {
  const { code, output } = await smoke([
    healthy.base,
    '--expect-commit',
    'fedcba9876543210fedcba9876543210fedcba98',
  ]);
  assert.equal(code, 1);
  assert.match(output, new RegExp(`no ar está ${COMMIT}, esperava fedcba98`));
  assert.match(output, /1 conferência\(s\) falharam/);
});

test('without the database, the smoke fails only when the database is required', async () => {
  const offline = await serve();
  offline.db.state.ready = false;

  const required = await smoke([offline.base, '--require-database']);
  assert.equal(required.code, 1);
  assert.match(
    required.output,
    /ERRO GET \/aouerj\/health: banco disconnected/,
  );
  assert.match(required.output, /ERRO GET \/aouerj\/docentes: status 503/);

  // sem exigir o banco, o 503 do status vale (a instância está de pé)
  const lenient = await smoke([offline.base]);
  assert.equal(lenient.code, 0, lenient.output);
});

/** Uma porta livre agora (para o servidor subir nela depois). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

test('--wait waits for an instance that is still starting', async () => {
  const port = await freePort();
  const pending = smoke([`http://127.0.0.1:${port}`, '--wait', '20']);
  // a instância sobe depois de a conferência começar
  await new Promise(resolve => setTimeout(resolve, 1500));
  await serve(port);
  const { code, output } = await pending;
  assert.equal(code, 0, output);
});

test('--via reaches another address and keeps the URL name in the Host', async () => {
  const hosts = new Set<string | undefined>();
  healthy.server.server.on('request', req => hosts.add(req.headers.host));
  const named = `http://ao-uerj.invalid:${healthy.port}`;

  const { code, output } = await smoke([named, '--via', '127.0.0.1']);
  assert.equal(code, 0, output);
  assert.match(output, new RegExp(`^conferindo ${named} via 127\\.0\\.0\\.1`));
  assert.deepEqual([...hosts], [`ao-uerj.invalid:${healthy.port}`]);
});
