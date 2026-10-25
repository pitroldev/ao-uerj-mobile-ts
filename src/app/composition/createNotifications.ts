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
import { activeAccount, onSavedScheduleChange } from './savedSchedule';

type Dependencies = {
  queryClient: QueryClient;
  identity: IdentityController;
  preferences: PreferencesStore;
  records: AcademicRecordsPort;
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
  const settings = new NotificationSettings({
    device,
    store: preferences,
    account,
    subscribeAccount: identity.subscribe,
    remote,
    schedule: owner => cache.read(owner, 'schedule'),
    reminderText,
  });
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
    // a permissão e os alarmes exatos podem mudar nas configurações do sistema
    AppState.addEventListener('change', state => {
      if (state === 'active') void settings.refreshDevice();
    });
  }
  settings.start();
  return { settings, portalCheck, portalReturn };
}
