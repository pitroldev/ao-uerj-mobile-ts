import { Platform } from 'react-native';

import { Ideas } from '@root/modules/ideas/application/Ideas';
import type {
  IdeasServerPort,
  IdeasStorePort,
} from '@root/modules/ideas/application/ports';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';

type Dependencies = {
  /** As sugestões no servidor (todo pedido leva a sessão de aluno). */
  server: IdeasServerPort;
  session: Pick<StudentSession, 'supported'>;
  preferences: IdeasStorePort;
  account: () => { scope: string } | null | undefined;
  appVersion: string;
  /** O sistema que vai no issue ("Android" ou "iPhone"). */
  os?: typeof Platform.OS;
};

/**
 * "Sugerir uma ideia": só onde o app entra como aluno (Play ou App Attest),
 * como o Agora no campus. O que o aparelho guarda fica nas preferências da
 * conta, que o logout apaga.
 */
export function createIdeas({
  server,
  session,
  preferences,
  account,
  appVersion,
  os = Platform.OS,
}: Dependencies) {
  return new Ideas({
    server: session.supported ? server : null,
    store: preferences,
    account,
    app: { version: appVersion, platform: os === 'ios' ? 'ios' : 'android' },
  });
}
