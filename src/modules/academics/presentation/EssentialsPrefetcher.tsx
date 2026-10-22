import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { usePortalStatus } from '@root/modules/connectivity/presentation/PortalStatusContext';
import { ReadAcademicRecords } from '../application/use-cases/ReadAcademicRecords';
import { academicQueryOptions, type AcademicResource } from './queries';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * O que precisa estar no aparelho para o app servir sem o portal. Notas e
 * RID ficam de fora: a verificação de avisos compara com o que o aluno viu, e
 * uma leitura que ele não viu apagaria a novidade.
 */
const ESSENTIALS = [
  'schedule',
  'history',
  'curriculum',
  'synthesis',
] as const satisfies readonly (AcademicResource & keyof ReadAcademicRecords)[];
/** No máximo uma rodada a cada meia hora por conta. */
const MIN_INTERVAL = 30 * 60 * 1000;

/**
 * Busca antecipada: com a conta logada, internet, o portal respondendo e o
 * app na tela, renova (uma página por vez) as leituras essenciais que já
 * passaram da validade, mesmo de telas que o aluno não abriu. Assim, quando
 * a internet ou o portal faltarem, elas estão salvas.
 */
export function EssentialsPrefetcher() {
  const { identity, queryClient, academicRecords } = useAppServices();
  const { account, status } = useIdentity();
  const online = useOnlineStatus();
  const { down } = usePortalStatus();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const lastRun = useRef(new Map<string, number>());
  const running = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const ready =
    account !== null &&
    (status === 'signedIn' || status === 'refreshing') &&
    online &&
    !down &&
    active;

  useEffect(() => {
    if (!ready || !account || running.current) return;
    const now = Date.now();
    if (now - (lastRun.current.get(account.scope) ?? 0) < MIN_INTERVAL) return;
    lastRun.current.set(account.scope, now);
    running.current = true;
    const records = new ReadAcademicRecords(academicRecords);
    void (async () => {
      for (const resource of ESSENTIALS) {
        // a troca de conta no meio para a rodada; com o portal fora, as
        // leituras seguintes falham na hora, sem ir a ele
        if (identity.getSnapshot().account?.scope !== account.scope) break;
        const read: (options: { signal?: AbortSignal }) => Promise<unknown> =
          records[resource];
        await queryClient
          .prefetchQuery(
            academicQueryOptions(identity, account, resource, read),
          )
          .catch(() => undefined);
      }
    })().finally(() => {
      running.current = false;
    });
  }, [academicRecords, account, identity, queryClient, ready]);

  return null;
}
