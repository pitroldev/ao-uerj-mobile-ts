/*
 * A conta de demonstração: as mesmas portas do Aluno Online e do nosso
 * servidor, respondidas no aparelho com um aluno fictício. Quem a escolhe é
 * a troca da composição (src/app/composition/backend/switchBackend.ts); nada
 * fora dela importa esta pasta.
 *
 * Regras (ver docs/funcionalidades.md, "Conta de demonstração"):
 * - nenhuma requisição ao Aluno Online e nenhuma identidade no servidor;
 * - nada do que se faz aqui sai do aparelho (mensagens, mesas, avisos ficam
 *   na memória até o app fechar);
 * - dados inventados (nenhum professor, aluno ou mensagem de verdade) e
 *   datas contadas a partir de hoje, para a conta nunca envelhecer.
 */
import { createDemoClock } from './clock';
import { createDemoAuthentication } from './ports/authentication';
import { createDemoCampus } from './ports/campus';
import { createDemoCompanion } from './ports/companion';
import {
  createDemoMessageBoard,
  createDemoTeacherDirectory,
} from './ports/community';
import { createDemoDocuments } from './ports/documents';
import { createDemoRecords } from './ports/records';
import { createDemoStudentSessionApi } from './ports/studentSession';

/**
 * O `Backend` da demo. Carregado só por `loadDemoBackend` (um `require`
 * que o knip não segue).
 * @public
 */
export function createDemoBackend(now: () => number = Date.now) {
  const clock = createDemoClock(now);
  return {
    authentication: createDemoAuthentication(clock),
    records: createDemoRecords(clock),
    documents: createDemoDocuments(clock),
    // sem portal: sempre "no ar", e nenhum aviso de queda
    portalProbe: { status: async () => 200 },
    portalStatus: { read: async () => null },
    messageBoard: createDemoMessageBoard(clock),
    teacherDirectory: createDemoTeacherDirectory(clock),
    // o relato mostra o sucesso e não vai a lugar nenhum
    errorReporter: { submit: async () => undefined },
    companion: createDemoCompanion(clock),
    campus: createDemoCampus(clock),
    studentSessionApi: createDemoStudentSessionApi(),
  };
}
