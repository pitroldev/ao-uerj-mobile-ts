import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

const DAY = 24 * 60 * 60 * 1000;
const DAY_MINUTES = 24 * 60;

/**
 * Sem atualizar a grade por três semanas (app fechado e sem verificação no
 * portal), os lembretes param: o período pode ter acabado.
 */
export const REMINDER_VALIDITY = 21 * DAY;

type ClassReminder = {
  /** Estável enquanto a aula não mudar (disciplina, turma, dia e horário). */
  id: string;
  /**
   * 1 = segunda … 7 = domingo. O portal só usa 1–6; o domingo aparece no
   * aviso de uma aula de segunda logo depois de 0h.
   */
  weekday: number;
  /** Minutos desde 0h do horário do aviso (início da aula − antecedência). */
  minutes: number;
  title: string;
  body: string;
};

/** Agenda entregue ao Android, que repete cada lembrete toda semana. */
export type ReminderPlan = {
  /** Depois deste instante (ms) nenhum lembrete é mostrado. */
  expiresAt: number;
  /** Antecedência: depois do início da aula, um lembrete atrasado não aparece. */
  leadMinutes: number;
  reminders: ClassReminder[];
};

export type ReminderText = { title: string; body: string };

/**
 * Um lembrete por aula da semana, sem as canceladas e os horários
 * desconhecidos. O texto vem de fora: a apresentação sabe montar sala e local.
 */
export function buildReminderPlan(
  schedule: readonly AttendedClassesSchedule[],
  {
    leadMinutes,
    fetchedAt,
    text,
  }: {
    leadMinutes: number;
    /** Quando a grade foi lida do portal (ms). */
    fetchedAt: number;
    text: (item: AttendedClassesSchedule) => ReminderText;
  },
): ReminderPlan {
  const seen = new Set<string>();
  const reminders = schedule.flatMap(item => {
    const start = item.start_time_in_minutes;
    if (
      item.class?.status === 'CANCELED' ||
      !Number.isInteger(item.dayNumber) ||
      item.dayNumber < 1 ||
      item.dayNumber > 7 ||
      !Number.isFinite(start) ||
      start < 0
    )
      return [];
    const id = `${item.class?.id ?? item.subject_id}#${item.class?.class ?? ''}@${
      item.dayNumber
    }:${start}`;
    if (seen.has(id)) return [];
    seen.add(id);
    // aula logo depois da meia-noite: o aviso fica para a noite anterior
    const at = start - leadMinutes;
    const previousDay = item.dayNumber === 1 ? 7 : item.dayNumber - 1;
    return [
      {
        id,
        weekday: at < 0 ? previousDay : item.dayNumber,
        minutes: at < 0 ? at + DAY_MINUTES : at,
        ...text(item),
      },
    ];
  });
  return { expiresAt: fetchedAt + REMINDER_VALIDITY, leadMinutes, reminders };
}
