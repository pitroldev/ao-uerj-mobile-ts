import { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import type {
  CampusNowServerPort,
  CampusNowStorePort,
} from '@root/modules/campus-now/application/ports';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';

type Dependencies = {
  /** O servidor do Agora no campus (todo pedido leva a sessão de aluno). */
  server: CampusNowServerPort;
  session: Pick<StudentSession, 'supported'>;
  preferences: CampusNowStorePort;
  account: () => { scope: string } | null | undefined;
};

/**
 * Agora no campus: só onde o app entra como aluno (Play ou App Attest). As
 * escolhas do aparelho ficam nas preferências da conta, que o logout apaga.
 */
export function createCampusNow({
  server,
  session,
  preferences,
  account,
}: Dependencies) {
  return new CampusNow({
    server: session.supported ? server : null,
    store: preferences,
    account,
    now: () => Date.now(),
  });
}
