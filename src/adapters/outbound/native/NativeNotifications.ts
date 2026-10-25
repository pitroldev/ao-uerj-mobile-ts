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
  os?: typeof Platform.OS;
  permissions?: Permissions;
  /** Nível da API do Android (o pedido de permissão existe a partir do 33). */
  apiLevel?: number;
};

/**
 * Avisos pelo módulo nativo local. No Android: canais, lembretes com
 * AlarmManager e as tarefas no portal com WorkManager. No iOS: lembretes de
 * aula agendados no UNUserNotificationCenter, sem tarefas no portal (o iOS
 * não garante quando uma tarefa em segundo plano roda). `null` onde o módulo
 * não existe.
 */
export function createNativeNotifications(
  module: Spec | null | undefined = NativeAppNotifications,
  {
    os = Platform.OS,
    permissions = PermissionsAndroid,
    apiLevel = os === 'android' ? Number(Platform.Version) : 0,
  }: Options = {},
): NotificationDevicePort | null {
  if (!module) return null;
  const enabled = async () =>
    (await module.areNotificationsEnabled()) ? 'granted' : 'denied';
  return {
    backgroundChecks: os === 'android',
    permission: enabled,
    async requestPermission(): Promise<PermissionState> {
      if ((await enabled()) === 'granted') return 'granted';
      // O iOS pergunta uma vez; depois da recusa, só os Ajustes liberam.
      if (os === 'ios')
        return (await module.requestPermission()) === 'granted'
          ? 'granted'
          : 'blocked';
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
    setEvaluationReminders: plan =>
      module.setEvaluationReminders(plan ? JSON.stringify(plan) : ''),
    async consumeDoneEvaluations() {
      const ids: unknown = await module.consumeDoneEvaluations();
      return Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === 'string')
        : [];
    },
    setPortalCheck: (on, intervalHours) =>
      module.setPortalCheck(on, intervalHours),
    setPortalReturnWatch: on => module.setPortalReturnWatch(on),
    notify: content => module.notify(content),
    clearPosted: () => module.clearNotifications(),
  };
}
