import type { EvaluationReminderPlan } from '@root/modules/evaluations/domain/reminders';
import type { ReminderPlan } from '../domain/classReminders';
import type { NotificationContent } from '../domain/messages';

/**
 * `blocked`: o aluno recusou de vez (ou desligou no sistema); só as
 * configurações do sistema liberam de novo.
 */
export type PermissionState = 'granted' | 'denied' | 'blocked';

/** Recursos do aparelho para avisos (módulo nativo do Android e do iOS). */
export interface NotificationDevicePort {
  /**
   * Roda as tarefas sem tela no portal (verificação periódica e "Avisar
   * quando voltar"): só no Android. No iOS ficam os lembretes de aula.
   */
  readonly backgroundChecks: boolean;
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  openSettings(): Promise<void>;
  /** Lembretes no horário exato ("Alarmes e lembretes"). */
  exactAlarmsAllowed(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  /** Substitui os lembretes de aula; `null` cancela todos. */
  setClassReminders(plan: ReminderPlan | null): Promise<void>;
  /** Substitui os lembretes das avaliações anotadas; `null` cancela todos. */
  setEvaluationReminders(plan: EvaluationReminderPlan | null): Promise<void>;
  /**
   * Avaliações marcadas com "Já fiz" no aviso desde a última leitura (o
   * aparelho já parou os lembretes delas); lidas uma vez.
   */
  consumeDoneEvaluations(): Promise<string[]>;
  /** Liga ou desliga a verificação periódica no portal (WorkManager). */
  setPortalCheck(enabled: boolean, intervalHours: number): Promise<void>;
  /** Liga ou desliga o teste do portal a cada 15 min ("Avisar quando voltar"). */
  setPortalReturnWatch(enabled: boolean): Promise<void>;
  notify(content: NotificationContent): Promise<void>;
  /**
   * Tira da barra os avisos já mostrados e cancela os lembretes de aula e
   * de avaliações (logout, troca de conta ou conta recusada na restauração).
   */
  clearPosted(): Promise<void>;
}

/** Armazenamento por conta (o logout apaga). */
export interface NotificationStore {
  read<T>(scope: string, key: string): Promise<T | null>;
  write<T>(scope: string, key: string, value: T): Promise<void>;
}

export type ActiveAccount = { scope: string; period: string };

/** Recursos acadêmicos que a verificação compara. */
export type CachedResource =
  'grades' | 'partial-rid' | 'enrollment-result' | 'schedule';

/**
 * A mesma cópia que o app mostra (cache das consultas): o que a verificação
 * lê ali já foi visto, e o que ela grava aparece no app sem nova consulta.
 */
export interface AcademicCachePort {
  read<T>(
    account: ActiveAccount,
    resource: CachedResource,
  ): { data: T; updatedAt: number } | null;
  write<T>(account: ActiveAccount, resource: CachedResource, data: T): void;
  /** Grava o cache em disco antes de o processo poder morrer. */
  flush(): Promise<void>;
}

/** Desligamento remoto (aviso remoto, `disabledFeatures: ["notifications"]`). */
export interface RemoteSwitch {
  disabled(): boolean;
  subscribe(listener: () => void): () => void;
}
