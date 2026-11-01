#!/usr/bin/env node
/*
 * Conferência de uma instância do servidor (server/) antes e depois de ela
 * receber tráfego. Só lê: nenhuma rota que grava é chamada, e as respostas
 * não vão para o log (o mural e os docentes vêm do banco de produção).
 *
 *   node smoke.mjs <url> [--wait <segundos>] [--require-database]
 *                        [--via <endereço>] [--expect-commit <sha>]
 *
 * --wait espera a instância responder (a partida, a conexão com o banco).
 * --require-database exige o banco conectado e confere as rotas dele.
 * --via conecta neste endereço com o nome da URL no TLS e no Host: o caminho
 *   do nginx de produção, sem depender da VM alcançar o próprio IP público.
 * --expect-commit exige que o `GET /aouerj/status` mostre este commit: a
 *   versão que responde é a que acabou de subir.
 *
 * Sem dependências: roda com o Node da VM e com o do CI.
 */
import http from 'node:http';
import https from 'node:https';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const base = new URL(args[0] ?? '');
const waitSeconds = Number(option('--wait') ?? 0);
const requireDatabase = flag('--require-database');
const via = option('--via');
const expectedCommit = option('--expect-commit');

/** Uma requisição com o corpo em JSON; devolve o status e o corpo lido. */
function call(method, path, body) {
  const url = new URL(path, base);
  const transport = url.protocol === 'https:' ? https : http;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        method,
        protocol: url.protocol,
        host: via ?? url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        servername: url.hostname,
        headers: {
          host: url.host,
          accept: 'application/json',
          'user-agent': 'ao-uerj-smoke',
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
        },
        timeout: 20000,
      },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => (text += chunk));
        response.on('end', () => {
          let json;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            json = undefined;
          }
          resolve({ status: response.statusCode ?? 0, json });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
    request.end(payload);
  });
}

const failures = [];
async function check(name, run) {
  try {
    const detail = await run();
    console.log(`  ok  ${name}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    failures.push(name);
    console.log(`  ERRO ${name}: ${error.message}`);
  }
}
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** Espera a instância responder e, se pedido, o banco conectar. */
async function waitUntilReady() {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    try {
      const { status, json } = await call('GET', '/aouerj/health');
      const ready =
        status === 200 &&
        json?.online === true &&
        (!requireDatabase || json.database === 'connected');
      if (ready) return;
    } catch {
      // ainda subindo
    }
    if (Date.now() >= deadline) return;
    await sleep(1000);
  }
}

// Um pedido pequeno ao gerador: A e B cabem juntas, C bate com A.
const interval = (day, start) => ({
  week_day: day,
  start_time_in_minutes: start,
  end_time_in_minutes: start + 100,
});
const subject = id => ({
  id,
  name: id,
  type: 'MANDATORY',
  credits: 4,
  total_workload: 60,
  prerequisites: [],
  allow_conflict: false,
});
const option_ = (id, day) => ({
  id: '1',
  name: id,
  type: 'REGULAR',
  teachers: [],
  vacancies_amount: 10,
  subject_id: id,
  schedules: [interval(day, 420)],
});
const generation = {
  preferences: {
    min_subject_amount: 1,
    max_subject_amount: 3,
    priority: ['MIN_GAPS'],
    busy_schedules: [],
  },
  subjects: ['SMOKE-A', 'SMOKE-B', 'SMOKE-C'].map(subject),
  classes: [
    option_('SMOKE-A', 0),
    option_('SMOKE-B', 1),
    option_('SMOKE-C', 0),
  ],
};

console.log(`conferindo ${base.origin}${via ? ` via ${via}` : ''}`);
if (waitSeconds) await waitUntilReady();

await check('GET /aouerj/health', async () => {
  const { status, json } = await call('GET', '/aouerj/health');
  expect(status === 200, `status ${status}`);
  expect(json?.online === true, 'sem "online": true');
  if (requireDatabase)
    expect(json.database === 'connected', `banco ${json.database}`);
  return `banco ${json.database}`;
});

await check('GET /aouerj/portal-status', async () => {
  const { status, json } = await call('GET', '/aouerj/portal-status');
  expect(status === 200, `status ${status}`);
  expect(['up', 'down', 'unknown'].includes(json?.state), 'estado inválido');
  return json.state;
});

await check('GET /aouerj/status', async () => {
  const { status, json } = await call('GET', '/aouerj/status');
  // sem o banco é 503, e só vale se o banco não for exigido
  expect(
    status === 200 || (!requireDatabase && status === 503),
    `status ${status}`,
  );
  expect(json?.release && json.generator, 'resposta sem a versão');
  if (expectedCommit)
    expect(
      json.release.commit === expectedCommit,
      `no ar está ${json.release.commit}, esperava ${expectedCommit}`,
    );
  return `${json.release.commit?.slice(0, 7) ?? 'sem commit'} ${json.release.color ?? ''}`.trim();
});

if (requireDatabase) {
  await check('GET /aouerj/docentes', async () => {
    const { status, json } = await call('GET', '/aouerj/docentes');
    expect(status === 200, `status ${status}`);
    expect(
      Array.isArray(json?.docentes) &&
        json.docentes.every(name => typeof name === 'string'),
      'a lista não é de textos',
    );
    return `${json.docentes.length} nomes`;
  });

  await check(
    'POST /aouerj/messages/get (conversa que não existe)',
    async () => {
      const { status, json } = await call('POST', '/aouerj/messages/get', {
        disciplina: 'SMOKE-00000',
        periodo: '1999.1',
        turma: '0',
      });
      expect(status === 200, `status ${status}`);
      expect(Array.isArray(json) && json.length === 0, 'esperava []');
    },
  );
}

await check('GET /aouerj/reportError sem token não lista e-mails', async () => {
  const { status } = await call('GET', '/aouerj/reportError');
  expect(status === 404 || status === 401, `status ${status}`);
});

await check('GET /schedules/health', async () => {
  const { status, json } = await call('GET', '/schedules/health');
  expect(status === 200 && json?.online === true, `status ${status}`);
});

await check('POST /schedules/generate', async () => {
  const { status, json } = await call(
    'POST',
    '/schedules/generate',
    generation,
  );
  expect(status === 200, `status ${status}`);
  expect(json?.exhaustive === true, 'busca incompleta');
  const best = json.data?.[0];
  expect(best?.schedule?.length === 2, 'a melhor grade não tem 2 disciplinas');
  expect(
    best.schedule.every(entry => entry.subject?.id === entry.subject_id),
    'turma sem a disciplina',
  );
  return `${json.data.length} grades`;
});

await check('POST /schedules/generate inválido é 400', async () => {
  const { status, json } = await call('POST', '/schedules/generate', {});
  expect(
    status === 400 && json?.error === 'invalid_request',
    `status ${status}`,
  );
});

if (failures.length) {
  console.log(`${failures.length} conferência(s) falharam`);
  process.exit(1);
}
console.log('tudo certo');
