import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Aviso mostrado na hora (verificação no portal). */
type NativeNotification = {
  /** O mesmo id substitui o aviso anterior. */
  id: string;
  /** `class-reminders`, `grades`, `enrollment` ou `documents`. */
  channel: string;
  title: string;
  body: string;
  /** Versão da tela de bloqueio quando o aparelho oculta conteúdo sensível. */
  publicTitle: string;
  publicBody: string;
  /** Tela aberta ao tocar: `home` ou `documents`. */
  target: string;
};

export interface Spec extends TurboModule {
  /** Avisos liberados para o app (permissão do Android 13+ e chave do sistema). */
  areNotificationsEnabled(): Promise<boolean>;
  /** Abre as configurações de notificação do app. */
  openNotificationSettings(): Promise<void>;
  /** Lembretes no horário exato; sempre `true` antes do Android 12. */
  canScheduleExactAlarms(): Promise<boolean>;
  /** Abre "Alarmes e lembretes" do app (Android 12+). */
  openExactAlarmSettings(): Promise<void>;
  /**
   * Substitui os lembretes de aula pelo JSON de um `ReminderPlan`; texto vazio
   * cancela todos. O Android repete cada um toda semana até `expiresAt`.
   */
  setClassReminders(plan: string): Promise<void>;
  /** Liga (a cada `intervalHours`) ou desliga a verificação no portal. */
  setPortalCheck(enabled: boolean, intervalHours: number): Promise<void>;
  notify(notification: NativeNotification): Promise<void>;
  /**
   * Cancela os lembretes de aula e tira da barra todos os avisos do app
   * (logout ou troca de conta).
   */
  clearNotifications(): Promise<void>;
  /** Destino do último aviso tocado (que abriu ou trouxe o app de volta); lido uma vez. */
  consumeLaunchTarget(): Promise<string | null>;
  /** Aviso tocado com o app em memória: o destino se lê com `consumeLaunchTarget`. */
  readonly onOpenTarget: CodegenTypes.EventEmitter<string>;
}

/** Só existe no Android (módulo local em android/app/.../notifications). */
export default TurboModuleRegistry.get<Spec>('AppNotifications');
