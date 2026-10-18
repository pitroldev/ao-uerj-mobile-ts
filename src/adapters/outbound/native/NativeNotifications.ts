import { PermissionsAndroid, Platform } from 'react-native';

import NativeAppNotifications, {
  type Spec,
} from '@root/specs/NativeAppNotifications';
import type {
  NotificationDevicePort,
  PermissionState,
} from '@root/modules/notifications/application/ports';

type Permissions = Pick<
  typeof PermissionsAndroid,
  'request' | 'PERMISSIONS' | 'RESULTS'
>;

type Options = {
  permissions?: Permissions;
  /** Nível da API do Android (o pedido de permissão existe a partir do 33). */
  apiLevel?: number;
};

/**
 * Avisos pelo módulo nativo local (canais, lembretes com AlarmManager e a
 * verificação periódica com WorkManager). `null` no iOS, onde o módulo não
 * existe.
 */
export function createNativeNotifications(
  module: Spec | null | undefined = NativeAppNotifications,
  {
    permissions = PermissionsAndroid,
    apiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0,
  }: Options = {},
): NotificationDevicePort | null {
  if (!module) return null;
  const enabled = async () =>
    (await module.areNotificationsEnabled()) ? 'granted' : 'denied';
  return {
    permission: enabled,
    async requestPermission(): Promise<PermissionState> {
      if ((await enabled()) === 'granted') return 'granted';
      // Antes do Android 13 não há pedido: a chave fica nas configurações.
      if (apiLevel < 33) return 'blocked';
      const result = await permissions.request(
        permissions.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result === permissions.RESULTS.GRANTED)
        // concedida, mas desligada no sistema: só as configurações resolvem
        return (await enabled()) === 'granted' ? 'granted' : 'blocked';
      return result === permissions.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
    },
    openSettings: () => module.openNotificationSettings(),
    exactAlarmsAllowed: () => module.canScheduleExactAlarms(),
    openExactAlarmSettings: () => module.openExactAlarmSettings(),
    setClassReminders: plan =>
      module.setClassReminders(plan ? JSON.stringify(plan) : ''),
    setPortalCheck: (on, intervalHours) =>
      module.setPortalCheck(on, intervalHours),
    notify: content => module.notify(content),
    clearPosted: () => module.clearNotifications(),
  };
}
