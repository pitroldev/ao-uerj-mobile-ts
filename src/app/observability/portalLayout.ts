import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import { AppError } from '@root/shared/errors/AppError';

type PortalPorts = {
  authentication: AuthenticationPort;
  records: AcademicRecordsPort;
  documents: DocumentsPort;
};

export type PortalLayoutReport = (error: AppError, operation: string) => void;

/**
 * Avisa quando o portal devolve uma página que os parsers não reconhecem
 * (AppError('PORTAL_LAYOUT_CHANGED')). Fica nas portas do AO, e não no cache
 * do TanStack, porque também cobre login, restauração e renovação de sessão,
 * que não são queries. Cada operação é reportada uma vez por execução do app:
 * quando o portal muda, todas as aberturas falham do mesmo jeito.
 */
export function reportPortalLayoutChanges<T extends PortalPorts>(
  ports: T,
  report: PortalLayoutReport,
): T {
  const reported = new Set<string>();
  const watch =
    <A extends unknown[], R>(
      operation: string,
      call: (...args: A) => Promise<R>,
    ) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(...args);
      } catch (error) {
        if (
          error instanceof AppError &&
          error.code === 'PORTAL_LAYOUT_CHANGED' &&
          !reported.has(operation)
        ) {
          reported.add(operation);
          report(error, operation);
        }
        throw error;
      }
    };
  const { authentication: auth, records: source } = ports;
  const authentication: AuthenticationPort = {
    signIn: watch('login', auth.signIn.bind(auth)),
    refresh: watch('login', auth.refresh.bind(auth)),
    signOut: auth.signOut.bind(auth),
  };
  const records: AcademicRecordsPort = {
    getGrades: watch('grades', source.getGrades.bind(source)),
    getHistory: watch('history', source.getHistory.bind(source)),
    getCurriculum: watch('curriculum', source.getCurriculum.bind(source)),
    getSchedule: watch('schedule', source.getSchedule.bind(source)),
    getPartialRid: watch('partial-rid', source.getPartialRid.bind(source)),
    getEnrollmentResult: watch(
      'enrollment-result',
      source.getEnrollmentResult.bind(source),
    ),
    getSubjectDetails: watch(
      'subject-details',
      source.getSubjectDetails.bind(source),
    ),
    getUniversalSubjects: watch(
      'universal-subjects',
      source.getUniversalSubjects.bind(source),
    ),
  };
  const documents: DocumentsPort = {
    list: watch('documents-list', ports.documents.list.bind(ports.documents)),
    issue: watch(
      'documents-issue',
      ports.documents.issue.bind(ports.documents),
    ),
    remove: watch(
      'documents-remove',
      ports.documents.remove.bind(ports.documents),
    ),
  };
  return { ...ports, authentication, records, documents };
}
