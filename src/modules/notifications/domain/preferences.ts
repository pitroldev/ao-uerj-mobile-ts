import {
  DEFAULT_DAY_TIME,
  DEFAULT_EARLY_TIME,
  DEFAULT_REMINDERS,
  REMINDER_KEYS,
  type ReminderKey,
} from '@root/modules/evaluations/domain/evaluations';

/** Antecedências oferecidas para o lembrete de aula, em minutos. */
export const REMINDER_LEADS = [10, 15, 30] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

/** O que uma avaliação nova traz de lembretes (cada uma muda os seus). */
export type EvaluationDefaults = {
  reminders: ReminderKey[];
  /** Horário dos lembretes de dias antes, em minutos desde 00:00. */
  earlyTime: number;
  /** Horário do lembrete "No dia", em minutos desde 00:00. */
  dayTime: number;
};

/**
 * Escolhas do aluno, por conta. Os avisos começam desligados: cada tipo é
 * opt-in, e a nota só aparece no texto do aviso se o aluno pedir. A exceção
 * são os lembretes de avaliações: o aluno os escolhe em cada avaliação que
 * anota, e a chave daqui só os desliga todos de uma vez.
 */
export type NotificationPreferences = {
  /** Lembrete antes de cada aula, a partir da grade salva (sem portal). */
  classReminders: boolean;
  reminderLead: ReminderLead;
  /** Lembretes das provas e trabalhos anotados (sem portal). */
  evaluationReminders: boolean;
  evaluationDefaults: EvaluationDefaults;
  /** Nota nova ou alterada em Notas do Período. */
  grades: boolean;
  /** Mostrar o valor da nota no aviso (desligado: só disciplina e prova). */
  gradeValues: boolean;
  /** Posição nova no RID Parcial e resultado da inscrição. */
  rid: boolean;
  /** Documento emitido perto de vencer. */
  documents: boolean;
  /** O aluno já respondeu ao convite do Início (ativou ou dispensou). */
  promptAnswered: boolean;
};

const DEFAULT_EVALUATION_DEFAULTS: EvaluationDefaults = {
  reminders: [...DEFAULT_REMINDERS],
  earlyTime: DEFAULT_EARLY_TIME,
  dayTime: DEFAULT_DAY_TIME,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  classReminders: false,
  reminderLead: 15,
  evaluationReminders: true,
  evaluationDefaults: DEFAULT_EVALUATION_DEFAULTS,
  grades: false,
  gradeValues: false,
  rid: false,
  documents: false,
  promptAnswered: false,
};

function isMinute(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 24 * 60
  );
}

function normalizeEvaluationDefaults(raw: unknown): EvaluationDefaults {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const fallback = DEFAULT_EVALUATION_DEFAULTS;
  return {
    reminders: Array.isArray(value.reminders)
      ? REMINDER_KEYS.filter(key =>
          (value.reminders as unknown[]).includes(key),
        )
      : [...fallback.reminders],
    earlyTime: isMinute(value.earlyTime) ? value.earlyTime : fallback.earlyTime,
    dayTime: isMinute(value.dayTime) ? value.dayTime : fallback.dayTime,
  };
}

/** Lê a cópia salva sem confiar no formato; o que faltar fica no padrão. */
export function normalizeNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const flag = (key: keyof NotificationPreferences) =>
    typeof value[key] === 'boolean'
      ? value[key]
      : (DEFAULT_NOTIFICATION_PREFERENCES[key] as boolean);
  const lead = REMINDER_LEADS.includes(value.reminderLead as ReminderLead)
    ? (value.reminderLead as ReminderLead)
    : DEFAULT_NOTIFICATION_PREFERENCES.reminderLead;
  return {
    classReminders: flag('classReminders'),
    reminderLead: lead,
    evaluationReminders: flag('evaluationReminders'),
    evaluationDefaults: normalizeEvaluationDefaults(value.evaluationDefaults),
    grades: flag('grades'),
    gradeValues: flag('gradeValues'),
    rid: flag('rid'),
    documents: flag('documents'),
    promptAnswered: flag('promptAnswered'),
  };
}

/** Avisos que dependem de consultar o Aluno Online em segundo plano. */
export function usesPortalChecks(
  preferences: NotificationPreferences,
): boolean {
  return preferences.grades || preferences.rid || preferences.documents;
}

export function hasAnyNotification(
  preferences: NotificationPreferences,
): boolean {
  return preferences.classReminders || usesPortalChecks(preferences);
}
