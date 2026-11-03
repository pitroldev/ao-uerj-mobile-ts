import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import type { WatchSnapshot } from '../application/CompanionWatch';
import type { CallKind } from '../domain/companion';

const NO_WATCH: WatchSnapshot = { scope: null, request: null };
const noSubscription = () => () => undefined;
const noSnapshot = () => NO_WATCH;

/**
 * "Me avise se abrirem": só no Android (a tarefa sem tela). `request` é o
 * pedido em curso da conta ativa (ainda valendo em `now`), ou `null`.
 */
export function useCompanionWatch(now: number) {
  const { notifications } = useAppServices();
  const watch = notifications.companionWatch ?? null;
  const { account } = useIdentity();
  const scope = account?.scope;
  useEffect(() => {
    void watch?.load();
  }, [watch, scope]);
  const snapshot = useSyncExternalStore(
    watch?.subscribe ?? noSubscription,
    watch?.getSnapshot ?? noSnapshot,
  );
  const live =
    snapshot.scope === scope &&
    snapshot.request !== null &&
    snapshot.request.until > now
      ? snapshot.request
      : null;

  const ask = useCallback(
    (kind: CallKind, until: number, seen: readonly string[]) =>
      watch ? watch.request(kind, until, seen) : Promise.resolve('denied'),
    [watch],
  );
  const cancel = useCallback(
    () => watch?.cancel() ?? Promise.resolve(),
    [watch],
  );
  const satisfied = useCallback(
    () => watch?.satisfied() ?? Promise.resolve(),
    [watch],
  );

  return { supported: Boolean(watch), request: live, ask, cancel, satisfied };
}
