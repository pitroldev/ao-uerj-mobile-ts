import { toIsoDate } from '@root/modules/attendance/domain/attendance';
import {
  comingReminders,
  EARLY_REMINDERS,
  isExam,
  isSettled,
  reminderAt,
  startOf,
  type Evaluation,
  type GradesBySubject,
  type ReminderKey,
} from './evaluations';

/** Os horários do aviso como hora local ("2026-11-23T20:00"). */
type WallTimes = { at: string; until: string; latest: string };

/** Um aviso de data única, entregue ao aparelho. */
type EvaluationReminder = {
  /**
   * Avaliação, antecedência e horário: muda quando a data muda, e o aparelho
   * mostra cada um uma vez só.
   */
  id: string;
  evaluationId: string;
  /** Quando o aviso aparece (ms). */
  at: number;
  /** Início da avaliação (ms): depois disso, o aviso não aparece. */
  until: number;
  /**
   * Até quando o texto continua certo (ms), para um aviso atrasado (Doze,
   * aparelho desligado): "Amanhã" vale o dia todo, "Hoje, 8:00" até o início
   * e "Em 1 hora" só 15 minutos.
   */
  latest: number;
  /**
   * Os mesmos horários na hora local: o Android os recalcula quando o fuso
   * muda, sem esperar o app abrir.
   */
  local: WallTimes;
  title: string;
  body: string;
  /** Traz o botão "Já fiz" (trabalhos, seminários e outras; não as provas). */
  completable: boolean;
};

/** O que fica agendado no aparelho; o plano novo substitui o anterior. */
export type EvaluationReminderPlan = { reminders: EvaluationReminder[] };

/**
 * Teto do plano, os mais próximos primeiro. O iPhone guarda só os 64 avisos
 * agendados mais próximos e divide a cota com os lembretes de aula.
 */
export const MAX_EVALUATION_REMINDERS = 60;

/** Um aviso de horas antes ("Em 1 hora") atrasado mais que isso estaria errado. */
const HOURS_TOLERANCE = 15 * 60 * 1000;

export type EvaluationReminderText = (
  evaluation: Evaluation,
  key: ReminderKey,
) => { title: string; body: string };

/** "2026-11-23T20:00", na hora local. */
function wall(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${toIsoDate(date)}T${hours}:${minutes}`;
}

/** Até quando o texto do lembrete continua certo, nunca depois do início. */
function latestFor(evaluation: Evaluation, key: ReminderKey): Date {
  const start = startOf(evaluation);
  const at = reminderAt(evaluation, key);
  let latest: Date;
  if (EARLY_REMINDERS.includes(key)) {
    // "Amanhã", "Em 3 dias": certos até o fim do dia do aviso
    latest = new Date(at.getFullYear(), at.getMonth(), at.getDate(), 23, 59);
  } else if (key === 'day') {
    latest = start;
  } else {
    latest = new Date(at.getTime() + HOURS_TOLERANCE);
  }
  return latest < start ? latest : start;
}

const NO_GRADES: GradesBySubject = new Map();

/**
 * Os lembretes que ainda vão chegar, de todas as avaliações não feitas e que
 * a nota não resolveu (a PF de quem foi dispensado não lembra), do mais
 * próximo ao mais distante. O texto vem de fora: a apresentação sabe montar a
 * sala do dia.
 */
export function buildEvaluationReminderPlan(
  evaluations: readonly Evaluation[],
  {
    now,
    text,
    grades = NO_GRADES,
  }: { now: Date; text: EvaluationReminderText; grades?: GradesBySubject },
): EvaluationReminderPlan {
  const reminders = evaluations
    .filter(item => !item.done && !isSettled(item, grades))
    .flatMap(item =>
      comingReminders(item, now).map(key => {
        const at = reminderAt(item, key);
        const until = startOf(item);
        const latest = latestFor(item, key);
        return {
          id: `${item.id}:${key}@${at.getTime()}`,
          evaluationId: item.id,
          at: at.getTime(),
          until: until.getTime(),
          latest: latest.getTime(),
          local: { at: wall(at), until: wall(until), latest: wall(latest) },
          ...text(item, key),
          completable: !isExam(item.type),
        };
      }),
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_EVALUATION_REMINDERS);
  return { reminders };
}
