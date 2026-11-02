/*
 * O servidor de verdade, com o banco em memória e um docente de exemplo, para
 * o teste de contrato do app (src/adapters/outbound/__tests__). Emite tokens
 * anônimos com uma chave criada aqui e a atestação de desenvolvimento (o app
 * no teste não tem a Play). Escreve `{"port":N}` numa linha quando está
 * ouvindo e sai no SIGTERM.
 */

import { generateKeyPairSync } from 'node:crypto';

import { createServer } from '../../src/composition.ts';
import { createPortalWatch } from '../../src/modules/portal/application.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from '../support.ts';

const memory = memoryRepositories();
memory.data.teachers.push({
  id: 'teacher-1',
  name: 'ADA LOVELACE',
  subjects: {
    'IME01-10001': {
      disciplina: 'CÁLCULO I',
      turmas: [
        { turma: 1, local: 'F-6001' },
        { turma: '2', local: null },
      ],
    },
  },
  createdAt: new Date(Date.UTC(2023, 2, 1)),
  updatedAt: new Date(Date.UTC(2023, 2, 1)),
});

// o portal fora do ar, visto há um minuto
const portal = createPortalWatch({
  probe: async () => 503,
  now: () => Date.now() - 60_000,
});
await portal.check();

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const issuerKey = privateKey
  .export({ type: 'pkcs8', format: 'der' })
  .toString('base64');

const config = testConfig({
  PRIVATE_TOKEN_KEYS: `${issuerKey}@2100-01-01`,
  TOKEN_ATTESTATION: 'development',
});
const server = createServer(config, silentLogger, {
  database: switchableDatabase().database,
  repositories: memory.repositories,
  attachments: memoryAttachments().store,
  portal,
});
const { port } = await server.start(0);
process.stdout.write(`${JSON.stringify({ port })}\n`);

process.once('SIGTERM', () => {
  server.stop().then(
    () => process.exit(0),
    () => process.exit(1),
  );
});
