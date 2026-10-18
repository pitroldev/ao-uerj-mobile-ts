/** Antecedências oferecidas para o lembrete de aula, em minutos. */
export const REMINDER_LEADS = [10, 15, 30] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

/**
 * Escolhas do aluno, por conta. Tudo começa desligado: cada tipo de aviso é
 * opt-in, e a nota só aparece no texto do aviso se o aluno pedir.
 */
export type NotificationPreferences = {
  /** Lembrete antes de cada aula, a partir da grade salva (sem portal). */
  classReminders: boolean;
  reminderLead: ReminderLead;
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

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  classReminders: false,
  reminderLead: 15,
  grades: false,
  gradeValues: false,
  rid: false,
  documents: false,
  promptAnswered: false,
};

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
