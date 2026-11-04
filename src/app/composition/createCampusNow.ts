import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import { createCampusNowServer } from '@root/adapters/outbound/private-api/campusNow';
import { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import type { CampusNowStorePort } from '@root/modules/campus-now/application/ports';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';

type Dependencies = {
  /** O cliente com a sessão de aluno (todas as rotas a levam). */
  student: PrivateApiHttpClient;
  session: Pick<StudentSession, 'supported'>;
  preferences: CampusNowStorePort;
  account: () => { scope: string } | null | undefined;
};

/**
 * Agora no campus: só onde o app entra como aluno (Android com a Play). As
 * escolhas do aparelho ficam nas preferências da conta, que o logout apaga.
 */
export function createCampusNow({
  student,
  session,
  preferences,
  account,
}: Dependencies) {
  return new CampusNow({
    server: session.supported ? createCampusNowServer(student) : null,
    store: preferences,
    account,
    now: () => Date.now(),
  });
}
