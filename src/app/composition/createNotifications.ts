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
import {
  NotificationSettings,
  PREFERENCES_KEY,
} from '@root/modules/notifications/application/NotificationSettings';
import { PortalCheck } from '@root/modules/notifications/application/PortalCheck';
import { GoodNews } from '@root/modules/notifications/application/GoodNews';
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
import type { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import { CompanionWatch } from '@root/modules/companion/application/CompanionWatch';
import { buildCompanionReminderPlan } from '@root/modules/companion/domain/reminders';
import {
  companionReminderText,
  companionWatchMessage,
} from '@root/modules/companion/presentation/companionText';
import {
  evaluationReminderText,
  gradesBySubject,
} from '@root/modules/evaluations/presentation/scheduleLookup';
import { evaluationsQueryKey } from '@root/modules/evaluations/presentation/queryKeys';
import type { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import { CampusWatch } from '@root/modules/campus-now/application/CampusWatch';
import {
  askNotification,
  confirmedNotification,
  levelNotification,
  thanksNotification,
} from '@root/modules/campus-now/presentation/campusNowText';
import { normalizeNotificationPreferences } from '@root/modules/notifications/domain/preferences';
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
  /**
   * As chamadas da Companhia agora em que o aluno está (os avisos delas) e a
   * lista, para o "Me avise se abrirem".
   */
  companion?: Pick<
    CompanionCalls,
    'load' | 'getSnapshot' | 'subscribe' | 'list'
  >;
  /**
   * Agora no campus: a lista (com a sessão de aluno) e as escolhas do
   * aparelho, para o "ainda está lá?" e os avisos dos avisos do aluno.
   */
  campusNow?: Pick<
    CampusNow,
    'supported' | 'list' | 'getSnapshot' | 'subscribe' | 'load'
  >;
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
  companion,
  campusNow,
  device = createNativeNotifications(),
}: Dependencies) {
  const campusDisabled = () =>
    isFeatureDisabled(remoteStatus.getSnapshot().status, 'campus');
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
    companionReminders: companion
      ? async () => {
          await companion.load();
          return buildCompanionReminderPlan(companion.getSnapshot(), {
            now: Date.now(),
            text: companionReminderText,
          });
        }
      : undefined,
    // a leitura a cada 15 min só para quem já abriu o Agora no campus
    campusWatch: campusNow?.supported
      ? async () => {
          if (campusDisabled()) return false;
          await campusNow.load();
          return campusNow.getSnapshot().visited;
        }
      : undefined,
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
  // "Me avise se abrirem": a mesma tarefa sem tela, lendo a lista
  const companionWatch =
    background && companion
      ? new CompanionWatch({
          device: background,
          store: preferences,
          account,
          savedScope,
          disabled: () =>
            isFeatureDisabled(remoteStatus.getSnapshot().status, 'companion'),
          list: () => companion.list(),
          memberships: async () => {
            await companion.load();
            return companion.getSnapshot();
          },
          message: companionWatchMessage,
          now: () => Date.now(),
        })
      : null;

  // Agora no campus no celular: a mesma tarefa sem tela, sem o portal
  const campusWatch =
    background && campusNow?.supported
      ? new CampusWatch({
          device: background,
          store: preferences,
          savedScope,
          allowed: async scope => {
            const saved = await preferences.read<unknown>(
              scope,
              PREFERENCES_KEY,
            );
            return normalizeNotificationPreferences(saved).campusAlerts;
          },
          disabled: () =>
            campusDisabled() ||
            isFeatureDisabled(
              remoteStatus.getSnapshot().status,
              'notifications',
            ),
          list: () => campusNow.list(),
          messages: {
            ask: askNotification,
            confirmed: confirmedNotification,
            thanks: thanksNotification,
            level: levelNotification,
          },
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
    // entrou, saiu ou abriu uma chamada: os avisos dela acompanham
    companion?.subscribe(() => {
      void settings.companionChanged();
    });
    // a primeira visita ao Agora no campus liga a leitura a cada 15 min; o
    // aviso remoto pode desligá-la
    campusNow?.subscribe(() => {
      void settings.campusChanged();
    });
    remoteStatus.subscribe(() => {
      void settings.campusChanged();
    });
    // na abertura, assim que a conta é conhecida
    identity.subscribe(() => {
      void consumeDone();
    });
    void consumeDone();
  }
  settings.start();
  return {
    settings,
    portalCheck,
    portalReturn,
    companionWatch,
    campusWatch,
    consumeDone,
    // as boas notícias da verificação viram momento bom na abertura
    goodNews: new GoodNews({
      store: preferences,
      account,
      now: () => Date.now(),
    }),
  };
}
