import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { startMongo } from './mongo.ts';

/*
 * O processo de verdade (`node src/main.ts`, o que o pm2 roda): a partida, o
 * log e o desligamento. O SIGTERM só existe fora do Windows (lá o kill
 * encerra na hora, sem o tratador), então esses testes rodam no CI.
 */
const MAIN = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const SIGNALS = process.platform !== 'win32';

type LogLine = Record<string, unknown> & { msg?: string };

let reportsDir: string;
const running = new Set<ReturnType<typeof spawn>>();

before(async () => {
  reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ao-uerj-main-'));
});

after(async () => {
  for (const child of running) child.kill('SIGKILL');
  await fs.rm(reportsDir, { recursive: true, force: true });
});

/** Sobe o main.ts só com o ambiente dado (o .env não é lido). */
function start(env: Record<string, string>) {
  const child = spawn(process.execPath, [MAIN], {
    env: {
      PATH: process.env.PATH ?? '',
      // o Windows precisa destes para o Node e a rede funcionarem
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
      // com --experimental-test-coverage, o processo filho também conta
      ...(process.env.NODE_V8_COVERAGE
        ? { NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE }
        : {}),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.add(child);
  const lines: LogLine[] = [];
  const waiting: Array<{
    match: (line: LogLine) => boolean;
    resolve: (line: LogLine) => void;
  }> = [];
  createInterface({ input: child.stdout }).on('line', text => {
    const line = JSON.parse(text) as LogLine;
    lines.push(line);
    for (const entry of waiting.filter(item => item.match(line))) {
      waiting.splice(waiting.indexOf(entry), 1);
      entry.resolve(line);
    }
  });
  let stderr = '';
  child.stderr.on('data', chunk => (stderr += chunk));
  const exited = new Promise<{ code: number | null; ms: number }>(resolve => {
    child.once('exit', code => {
      running.delete(child);
      resolve({ code, ms: performance.now() - spawnedAt });
    });
  });
  const spawnedAt = performance.now();

  /** A primeira linha de log com esta mensagem (já escrita ou a próxima). */
  const logged = (msg: string, timeoutMs = 20_000) => {
    const found = lines.find(line => line.msg === msg);
    if (found) return Promise.resolve(found);
    return new Promise<LogLine>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`sem "${msg}" no log: ${stderr}`)),
        timeoutMs,
      );
      waiting.push({
        match: line => line.msg === msg,
        resolve: line => {
          clearTimeout(timer);
          resolve(line);
        },
      });
    });
  };
  return { child, lines, logged, exited, stderr: () => stderr };
}

/** O ambiente de produção, com o banco e a porta do teste. */
const production = (mongoUri: string): Record<string, string> => ({
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: '0',
  LOG_LEVEL: 'info',
  MONGODB_URI: mongoUri,
  MONGODB_TIMEOUT_MS: '300',
  PORTAL_MONITOR: 'off',
  REPORTS_DIR: reportsDir,
  RELEASE_COMMIT: 'abc1234',
  RELEASE_COLOR: 'blue',
});

/** Um banco que recusa a conexão na hora. */
const NO_DATABASE = 'mongodb://127.0.0.1:9/ao-uerj';

test('an invalid configuration stops the start with every problem listed', async () => {
  const run = start({ PORT: '70000', FORCE_HTTPS: 'true' });
  const { code } = await run.exited;
  assert.equal(code, 1);
  assert.match(run.stderr(), /PORT/);
  assert.match(run.stderr(), /PUBLIC_URL/);
  assert.equal(run.lines.length, 0);
});

test('the process listens without waiting for the database and logs JSON without who asked', async () => {
  const run = start(production(NO_DATABASE));
  const listening = await run.logged('listening');
  const base = `http://127.0.0.1:${Number(listening.port)}`;

  assert.equal((await fetch(`${base}/aouerj/health`)).status, 200);
  const status = await fetch(`${base}/aouerj/status`, {
    headers: { 'user-agent': 'aluno-123', 'x-forwarded-for': '200.1.2.3' },
  });
  assert.equal(status.status, 503);
  const body = (await status.json()) as {
    release: { commit: string; color: string };
  };
  assert.deepEqual(
    { commit: body.release.commit, color: body.release.color },
    { commit: 'abc1234', color: 'blue' },
  );

  const request = await run.logged('request completed');
  // uma linha por evento, com o nível em texto e a hora em ISO
  for (const line of run.lines) {
    assert.equal(line.service, 'ao-uerj-server');
    assert.equal(typeof line.level, 'string');
    assert.match(String(line.time), /^\d{4}-\d\d-\d\dT/);
  }
  // nem IP, nem User-Agent, nem cabeçalhos
  const text = JSON.stringify(run.lines);
  assert.doesNotMatch(text, /aluno-123|200\.1\.2\.3|remoteAddress|headers/);
  assert.deepEqual(Object.keys(request.req as object).sort(), [
    'id',
    'method',
    'path',
  ]);
  run.child.kill('SIGKILL');
  await run.exited;
});

test(
  'SIGTERM ends the process by itself while the database is still being retried',
  { skip: !SIGNALS && 'sem sinais no Windows' },
  async () => {
    const run = start(production(NO_DATABASE));
    await run.logged('listening');
    await run.logged('MongoDB connection failed');
    run.child.kill('SIGTERM');
    const { code } = await run.exited;
    assert.equal(code, 0);
    assert.ok(run.lines.some(line => line.msg === 'shutting down'));
  },
);

test(
  'SIGTERM during a database outage still ends the process, threads and all',
  { skip: !SIGNALS && 'sem sinais no Windows' },
  async () => {
    const mongo = await startMongo();
    try {
      const run = start(production(mongo.getUri('ao-uerj')));
      const listening = await run.logged('listening');
      await run.logged('MongoDB connected');
      // uma geração deixa uma thread aquecida no pool
      const generated = await fetch(
        `http://127.0.0.1:${Number(listening.port)}/schedules/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            preferences: {
              min_subject_amount: 1,
              max_subject_amount: 1,
              priority: [],
            },
            subjects: [
              {
                id: 'IME01-10001',
                name: 'A',
                type: 'MANDATORY',
                credits: 4,
                total_workload: 60,
                prerequisites: [],
                allow_conflict: false,
              },
            ],
            classes: [
              {
                id: '1',
                name: 'A',
                type: 'REGULAR',
                teachers: [],
                vacancies_amount: 1,
                subject_id: 'IME01-10001',
                schedules: [
                  {
                    week_day: 0,
                    start_time_in_minutes: 420,
                    end_time_in_minutes: 520,
                  },
                ],
              },
            ],
          }),
        },
      );
      assert.equal(generated.status, 200);

      // o banco cai: a conexão se diz fechada, mas o driver segue tentando
      await mongo.stop();
      await new Promise(resolve => setTimeout(resolve, 500));
      run.child.kill('SIGTERM');
      const { code } = await run.exited;
      assert.equal(code, 0);
    } finally {
      await mongo.stop();
    }
  },
);
