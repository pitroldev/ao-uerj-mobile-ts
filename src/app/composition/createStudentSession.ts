import { AppState, Platform } from 'react-native';

import { createNativeAppAttest } from '@root/adapters/outbound/native/NativeAppAttest';
import { createNativeDeviceTrust } from '@root/adapters/outbound/native/NativeDeviceTrust';
import { createStudentSessionStore } from '@root/adapters/outbound/persistence/student-session-store';
import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import { createStudentSessionApi } from '@root/adapters/outbound/private-api/studentSession';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import { StudentSession } from '@root/modules/trust/application/StudentSession';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';

/** A espera ao acaso entre o login e a primeira entrada no servidor. */
const WARM_UP_MS = { min: 5_000, max: 30_000 };

type Account = { scope: string; matricula: string; name: string };

/**
 * Quem atesta o app neste aparelho: o App Attest no iPhone, a Play Integrity
 * no Android. `null` onde não há (simulador, módulo ausente).
 */
export function createDeviceTrust(
  os: typeof Platform.OS = Platform.OS,
): DeviceTrustPort | null {
  return os === 'ios' ? createNativeAppAttest() : createNativeDeviceTrust();
}

/**
 * A sessão de aluno no servidor: só onde há atestação (a Play no Android, o
 * App Attest no iPhone) e o cofre. `account` é lida na hora de entrar (a
 * conta logada).
 */
export function createStudentSession({
  vault,
  client,
  account,
  device = createDeviceTrust(),
}: {
  vault: SecureVault | null;
  client: PrivateApiHttpClient;
  account: () => Account | null | undefined;
  device?: DeviceTrustPort | null;
}) {
  return new StudentSession({
    api: createStudentSessionApi(client),
    device,
    store: vault ? createStudentSessionStore(vault) : null,
    account,
  });
}

/**
 * A sessão acompanha o login: entra um pouco depois do login confirmado no
 * Aluno Online (a primeira tela que precisa já a encontra pronta) e sai no
 * logout, encerrando no servidor. `beforeClear` (sair das mesas e dos
 * grupos) roda antes, ainda com a sessão.
 */
export function followIdentity(
  session: Pick<StudentSession, 'supported' | 'token' | 'current' | 'clear'>,
  identity: Pick<IdentityController, 'getSnapshot' | 'subscribe'>,
  {
    beforeClear = async () => undefined,
    random = Math.random,
  }: { beforeClear?: () => Promise<void>; random?: () => number } = {},
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous = identity.getSnapshot().status;
  identity.subscribe(() => {
    const { status, error } = identity.getSnapshot();
    if (status === 'signedOut') {
      if (timer) clearTimeout(timer);
      timer = null;
      if (previous !== 'signedOut') {
        // a sessão de quem saiu, guardada já: se outra conta entrar antes do
        // fim da saída, a dela não é encerrada
        const leaving = session.current().catch(() => null);
        void beforeClear()
          .catch(() => undefined)
          .then(async () => session.clear(await leaving))
          .catch(() => undefined);
      }
    } else if (
      session.supported &&
      status === 'signedIn' &&
      !error &&
      AppState.currentState === 'active' &&
      !timer
    ) {
      const delay =
        WARM_UP_MS.min + random() * (WARM_UP_MS.max - WARM_UP_MS.min);
      timer = setTimeout(() => {
        timer = null;
        // sem rede ou banido: a tela que precisar mostra o motivo
        void session.token().catch(() => undefined);
      }, delay);
    }
    previous = status;
  });
}
