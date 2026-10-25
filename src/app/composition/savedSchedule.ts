import type { QueryClient } from '@tanstack/react-query';

import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';

/** Dono do cache das consultas: conta e período. */
export type CacheOwner = { scope: string; period: string };

/** Conta ativa: `undefined` enquanto a conta salva não foi lida, `null` sem conta. */
export function activeAccount(
  identity: Pick<IdentityController, 'getSnapshot'>,
): () => CacheOwner | null | undefined {
  return () => {
    const snapshot = identity.getSnapshot();
    // a conta salva vale desde a abertura, antes do login no portal
    if (snapshot.status === 'restoring' && !snapshot.account) return undefined;
    return snapshot.account
      ? { scope: snapshot.account.scope, period: snapshot.account.period }
      : null;
  };
}

/** Grade salva da conta (a mesma do Início), com a hora da leitura. */
export function readSavedSchedule(
  queryClient: QueryClient,
  owner: CacheOwner,
): { data: AttendedClassesSchedule[]; updatedAt: number } | null {
  const state = queryClient.getQueryState<AttendedClassesSchedule[]>(
    academicKeys.resource(owner.scope, owner.period, 'schedule'),
  );
  return state?.data === undefined
    ? null
    : { data: state.data, updatedAt: state.dataUpdatedAt };
}

/**
 * Avisa quando a grade salva da conta ativa muda: lida pela tela, restaurada
 * do disco ou gravada pela verificação em segundo plano.
 */
export function onSavedScheduleChange(
  queryClient: QueryClient,
  account: () => CacheOwner | null | undefined,
  listener: () => void,
): () => void {
  return onSavedResourceChange(queryClient, account, 'schedule', listener);
}

/** Avisa quando um recurso salvo da conta ativa (grade, notas) muda. */
export function onSavedResourceChange(
  queryClient: QueryClient,
  account: () => CacheOwner | null | undefined,
  resource: string,
  listener: () => void,
): () => void {
  return queryClient.getQueryCache().subscribe(event => {
    const owner = account();
    const [root, scope, period, key] = event.query.queryKey;
    if (
      !owner ||
      root !== 'academics' ||
      scope !== owner.scope ||
      period !== owner.period ||
      key !== resource
    )
      return;
    const loaded =
      (event.type === 'updated' && event.action.type === 'success') ||
      (event.type === 'added' && event.query.state.data !== undefined);
    if (loaded) listener();
  });
}
