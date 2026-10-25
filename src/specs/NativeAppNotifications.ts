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
  /**
   * Pede a permissão de avisos: `granted` ou `blocked`. É o caminho do iOS;
   * no Android o pedido sai do `PermissionsAndroid` e aqui só se lê o estado.
   */
  requestPermission(): Promise<string>;
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
  /**
   * Liga ou desliga o teste do portal a cada 15 min, com rede, para o aviso
   * "Avisar quando voltar" (a mesma tarefa sem tela, no modo `return`).
   */
  setPortalReturnWatch(enabled: boolean): Promise<void>;
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

/**
 * Módulo local: android/app/.../notifications e
 * ios/AOUerjMobile/Native/AppNotificationsModule.mm.
 */
export default TurboModuleRegistry.get<Spec>('AppNotifications');
