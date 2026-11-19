import { createAlunoOnlineAdapter } from '@root/adapters/outbound/aluno-online';
import {
  createNativeCookieJar,
  createNativePortalTransport,
} from '@root/adapters/outbound/aluno-online/nativeTransport';
import { observePortalTransport } from '@root/adapters/outbound/aluno-online/observedTransport';
import { createPortalPages } from '@root/adapters/outbound/aluno-online/reportPages';
import { isDemoAccount } from '@root/adapters/outbound/demo/account';
import {
  createPrivateApiAdapters,
  type PrivateApiHttpClient,
} from '@root/adapters/outbound/private-api';
import {
  createCampusNowServer,
  createCampusPushServer,
} from '@root/adapters/outbound/private-api/campusNow';
import {
  createCompanionServer,
  createCompanionWatchServer,
} from '@root/adapters/outbound/private-api/companion';
import { createSessionClient } from '@root/adapters/outbound/private-api/sessionClient';
import { createStudentSessionApi } from '@root/adapters/outbound/private-api/studentSession';
import type { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import type { CredentialStore } from '@root/modules/identity/application/ports';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';
import {
  reportPortalLayoutChange,
  reportPortalLayoutChanges,
} from '../../observability';
import type { Backend } from './Backend';

type Dependencies = {
  credentials: Pick<CredentialStore, 'read'>;
  monitor: Pick<PortalMonitor, 'guard' | 'answered' | 'failed'>;
  /** O cliente do nosso servidor, sem a sessão de aluno. */
  client: PrivateApiHttpClient;
  /**
   * A sessão de aluno, lida na hora do pedido: ela nasce depois do backend,
   * porque entra pela porta `studentSessionApi` da troca.
   */
  session: () => Pick<StudentSession, 'token' | 'invalidate' | 'banned'>;
};

/** O Aluno Online e o nosso servidor de verdade. */
export function createRealBackend({
  credentials,
  monitor,
  client,
  session,
}: Dependencies): Backend {
  const transport = createNativePortalTransport();
  const portal = reportPortalLayoutChanges(
    createAlunoOnlineAdapter({
      transport: observePortalTransport(transport, monitor),
      cookies: createNativeCookieJar(),
      // o novo login que uma leitura faz sozinha nunca leva a conta demo
      // ao portal
      readCredentials: async () => {
        const saved = (await credentials.read())?.credentials ?? null;
        return saved && !isDemoAccount(saved) ? saved : null;
      },
    }),
    reportPortalLayoutChange,
  );
  const student = createSessionClient(client, {
    token: () => session().token(),
    invalidate: token => session().invalidate(token),
    banned: ban => session().banned(ban),
  });
  const server = createPrivateApiAdapters(client, student);
  return {
    authentication: portal.authentication,
    records: portal.records,
    documents: portal.documents,
    // a página inicial do portal: leve e o primeiro passo do próprio login
    portalProbe: {
      status: async () => (await transport.request({ path: '/' })).status,
    },
    portalStatus: server.portalStatus,
    messageBoard: server.messageBoard,
    teacherDirectory: server.teacherDirectory,
    errorReporter: server.errorReporter,
    portalPages: createPortalPages(portal.diagnostics),
    companion: createCompanionServer(student, student),
    companionWatch: createCompanionWatchServer(student),
    campus: createCampusNowServer(student),
    campusPush: createCampusPushServer(student),
    studentSessionApi: createStudentSessionApi(client),
  };
}
