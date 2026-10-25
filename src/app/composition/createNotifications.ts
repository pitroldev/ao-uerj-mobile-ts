import { AppState } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';

import { createNativeNotifications } from '@root/adapters/outbound/native/NativeNotifications';
import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import { isFeatureDisabled } from '@root/modules/delivery/domain/appStatus';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { NotificationSettings } from '@root/modules/notifications/application/NotificationSettings';
import { PortalCheck } from '@root/modules/notifications/application/PortalCheck';
import { PortalReturnAlert } from '@root/modules/notifications/application/PortalReturnAlert';
import type {
  AcademicCachePort,
  ActiveAccount,
  CachedResource,
  NotificationDevicePort,
  RemoteSwitch,
} from '@root/modules/notifications/application/ports';
import { reminderText } from '@root/modules/notifications/presentation/reminderText';
import type {
  AttendedClassesSchedule,
  ClassGrade,
} from '@root/modules/academics/domain/models';
import type { EvaluationRecords } from '@root/modules/evaluations/application/EvaluationRecords';
import { buildEvaluationReminderPlan } from '@root/modules/evaluations/domain/reminders';
import {
  evaluationReminderText,
  gradesBySubject,
} from '@root/modules/evaluations/presentation/scheduleLookup';
import { evaluationsQueryKey } from '@root/modules/evaluations/presentation/queryKeys';
import {
  activeAccount,
  onSavedResourceChange,
  onSavedScheduleChange,
} from './savedSchedule';

type Dependencies = {
  queryClient: QueryClient;
  identity: IdentityController;
  preferences: PreferencesStore;
  records: AcademicRecordsPort;
  /** Provas e trabalhos anotados (só no aparelho): os lembretes saem daqui. */
  evaluations: Pick<EvaluationRecords, 'read' | 'setDone'>;
  documents: Pick<DocumentsPort, 'list'>;
  remoteStatus: Pick<RemoteStatus, 'getSnapshot' | 'subscribe'>;
  flushCache: () => Promise<void>;
  /** Conta salva (keychain), lida sem o portal. */
  savedScope: () => Promise<string | null>;
  /** Requisição leve ao portal, sem login: `true` se ele respondeu. */
  probePortal: () => Promise<boolean>;
  device?: NotificationDevicePort | null;
};

/**
 * Avisos: preferências por conta, lembretes de aula e a verificação no
 * portal. A verificação lê e grava o cache das consultas, o mesmo que as
 * telas usam: o que o app já mostrou não vira aviso, e o que ela leu aparece
 * no app sem nova consulta.
 */
export function createNotifications({
  queryClient,
  identity,
  preferences,
  records,
  evaluations,
  documents,
  remoteStatus,
  flushCache,
  savedScope,
  probePortal,
  device = createNativeNotifications(),
}: Dependencies) {
  const account = activeAccount(identity);
  const key = (owner: ActiveAccount, resource: CachedResource) =>
    academicKeys.resource(owner.scope, owner.period, resource);
  const cache: AcademicCachePort = {
    read<T>(owner: ActiveAccount, resource: CachedResource) {
      const state = queryClient.getQueryState<T>(key(owner, resource));
      return state?.data === undefined
        ? null
        : { data: state.data, updatedAt: state.dataUpdatedAt };
    },
    write<T>(owner: ActiveAccount, resource: CachedResource, data: T) {
      queryClient.setQueryData(key(owner, resource), data);
    },
    flush: flushCache,
  };
  const remote: RemoteSwitch = {
    disabled: () =>
      isFeatureDisabled(remoteStatus.getSnapshot().status, 'notifications'),
    subscribe: remoteStatus.subscribe,
  };
  /**
   * "Já fiz" lidos do aparelho e ainda não gravados: o aparelho os esquece ao
   * entregá-los, então ficam aqui (e fora do plano) até a gravação dar certo.
   */
  let pendingDone: { scope: string; ids: string[] } | null = null;
  const settings = new NotificationSettings({
    device,
    store: preferences,
    account,
    subscribeAccount: identity.subscribe,
    remote,
    schedule: owner => cache.read(owner, 'schedule'),
    reminderText,
    // a sala do dia vem da grade salva; sem ela, o aviso sai sem a sala
    // a sala do dia vem da grade salva e as notas decidem o que não vale
    // mais (a PF de quem foi dispensado); sem elas, o aviso sai sem a sala
    evaluationReminders: async owner => {
      const pending = pendingDone?.scope === owner.scope ? pendingDone.ids : [];
      const list = await evaluations.read(owner.scope, owner.period);
      return buildEvaluationReminderPlan(
        list.filter(item => !pending.includes(item.id)),
        {
          now: new Date(),
          text: evaluationReminderText(
            cache.read<AttendedClassesSchedule[]>(owner, 'schedule')?.data ??
              [],
          ),
          grades: gradesBySubject(
            cache.read<ClassGrade[]>(owner, 'grades')?.data ?? [],
          ),
        },
      );
    },
  });
  /**
   * "Já fiz" tocado nos avisos: o aparelho já parou os lembretes; aqui a
   * avaliação sai das próximas, na tela e no plano.
   */
  const consumeDone = async () => {
    const owner = account();
    if (!device || !owner) return;
    const read = await device.consumeDoneEvaluations().catch(() => []);
    // os de outra conta saíram com ela (o logout limpa o aparelho)
    const earlier = pendingDone?.scope === owner.scope ? pendingDone.ids : [];
    const ids = [...new Set([...earlier, ...read])];
    if (!ids.length) return;
    pendingDone = { scope: owner.scope, ids };
    const next = await evaluations
      .setDone(owner.scope, owner.period, ids, true)
      .catch(() => null);
    if (next && pendingDone?.scope === owner.scope) {
      const left = pendingDone.ids.filter(id => !ids.includes(id));
      pendingDone = left.length ? { scope: owner.scope, ids: left } : null;
    }
    if (next && account()?.scope === owner.scope) {
      queryClient.setQueryData(
        evaluationsQueryKey(owner.scope, owner.period),
        next,
      );
    }
    void settings.evaluationsChanged();
  };
  // as tarefas sem tela no portal só existem no Android (no iOS, os lembretes)
  const background = device?.backgroundChecks ? device : null;
  const portalCheck = background
    ? new PortalCheck({
        records,
        documents,
        cache,
        device: background,
        store: preferences,
        account,
        savedScope,
        remote,
        now: () => Date.now(),
        onRecorded: (scope, state) => settings.checkRecorded(scope, state),
      })
    : null;
  const portalReturn = background
    ? new PortalReturnAlert({
        device: background,
        store: preferences,
        account,
        savedScope,
        remote,
        probe: probePortal,
        now: () => Date.now(),
      })
    : null;

  if (device) {
    // A grade salva mudou (tela, cache restaurado ou verificação): os
    // lembretes acompanham.
    onSavedScheduleChange(queryClient, account, () => {
      void settings.scheduleChanged();
    });
    // notas novas podem dispensar a PF: os lembretes dela saem
    onSavedResourceChange(queryClient, account, 'grades', () => {
      void settings.evaluationsChanged();
    });
    // a permissão e os alarmes exatos podem mudar nas configurações do sistema
    AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void settings.refreshDevice();
      void consumeDone();
    });
    // na abertura, assim que a conta é conhecida
    identity.subscribe(() => {
      void consumeDone();
    });
    void consumeDone();
  }
  settings.start();
  return { settings, portalCheck, portalReturn, consumeDone };
}
