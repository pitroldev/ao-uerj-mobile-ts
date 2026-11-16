import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type { CampusNowServerPort } from '@root/modules/campus-now/application/ports';
import type {
  MessageBoardPort,
  TeacherDirectoryPort,
} from '@root/modules/community/application/ports';
import type { CompanionServerPort } from '@root/modules/companion/application/ports';
import type { SharedPortalStatusPort } from '@root/modules/connectivity/application/ports';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import type { ErrorReporterPort } from '@root/modules/support/application/ports';
import type { StudentSessionApiPort } from '@root/modules/trust/application/ports';

/** O teste leve do portal: o status HTTP da página inicial. */
interface PortalProbePort {
  status(): Promise<number>;
}

/**
 * Tudo o que o app pede ao mundo de fora e que muda com a conta: o Aluno
 * Online e o nosso servidor. A conta de demonstração responde a lista
 * inteira no aparelho (ver `switchBackend`), então uma porta nova que fale
 * com a rede entra aqui, e sem a versão demo o app não compila.
 *
 * Ficam de fora o que é igual para as duas contas: o gerador de grade (vai
 * ao servidor sem identificar o aluno quando não há sessão), o aviso remoto
 * e as atualizações OTA.
 */
export type Backend = {
  authentication: AuthenticationPort;
  records: AcademicRecordsPort;
  documents: DocumentsPort;
  portalProbe: PortalProbePort;
  portalStatus: SharedPortalStatusPort;
  messageBoard: MessageBoardPort;
  teacherDirectory: TeacherDirectoryPort;
  errorReporter: ErrorReporterPort;
  companion: CompanionServerPort;
  campus: CampusNowServerPort;
  studentSessionApi: StudentSessionApiPort;
};
