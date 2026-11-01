/*
 * O servidor de verdade, com o banco em memória e um docente de exemplo, para
 * o teste de contrato do app (src/adapters/outbound/__tests__). Escreve
 * `{"port":N}` numa linha quando está ouvindo e sai no SIGTERM.
 */

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

const server = createServer(testConfig(), silentLogger, {
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
