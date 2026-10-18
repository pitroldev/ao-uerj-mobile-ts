import { TIME_VALUES } from '@root/utils/constants/time';

/**
 * Frequência mínima para aprovação: 75% das horas-aula da disciplina (art. 95
 * da Deliberação nº 33/CSEPE/1995, regime de créditos). Abaixo disso o aluno
 * reprova sem direito à PF (§ 8º).
 */
const MINIMUM_ATTENDANCE = 0.75;

/** Uma aula em que o aluno marcou falta (registro local, só no aparelho). */
export type Absence = {
  /** Código numérico da disciplina (o de `subjectKey`). */
  subjectId: string;
  /** Dia da aula, "AAAA-MM-DD" no fuso do aparelho. */
  date: string;
  /** Início da aula, em minutos desde 00:00. */
  start: number;
  /**
   * Fim da aula, em minutos desde 00:00: o horário da lista continua o mesmo
   * depois que a aula sai da janela de 4 semanas.
   */
  end: number;
  /** Tempos de aula (de 50 minutos) que a falta vale. */
  slots: number;
};

/** Uma aula da grade num dia certo. */
export type ClassMeeting = Absence;

/** Aula semanal da grade: dia da semana do JS (0 = domingo) e minutos. */
export type WeeklyClass = {
  subjectId: string;
  weekday: number;
  start: number;
  end: number;
};

export function absenceKey(
  item: Pick<Absence, 'subjectId' | 'date' | 'start'>,
): string {
  return `${item.subjectId}@${item.date}@${item.start}`;
}

/** "2026-10-15" no fuso do aparelho. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Tempos de aula entre o início e o fim ("T6–N1" são 2). Fora da tabela de
 * tempos da UERJ, conta um tempo a cada 50 minutos.
 */
export function slotCount(start: number, end: number): number {
  const slots = TIME_VALUES.filter(
    slot =>
      slot.start_time_in_minutes >= start && slot.end_time_in_minutes <= end,
  ).length;
  return slots > 0 ? slots : Math.max(1, Math.round((end - start) / 50));
}

/** Marca (ou desmarca) a falta numa aula; uma falta por aula. */
export function setAbsence(
  absences: readonly Absence[],
  meeting: ClassMeeting,
  absent: boolean,
): Absence[] {
  const key = absenceKey(meeting);
  const rest = absences.filter(item => absenceKey(item) !== key);
  if (!absent) return rest;
  const { subjectId, date, start, end, slots } = meeting;
  return [...rest, { subjectId, date, start, end, slots }];
}

export function absentSlots(
  absences: readonly Absence[],
  subjectId: string,
): number {
  return absences.reduce(
    (total, item) => total + (item.subjectId === subjectId ? item.slots : 0),
    0,
  );
}

/**
 * Tempos de falta que a disciplina tolera: 25% da carga horária, para baixo
 * (60 h → 15; 90 h → 22). Sem carga horária conhecida, não há limite.
 */
export function absenceLimit(
  workload: number | null | undefined,
): number | null {
  if (typeof workload !== 'number' || !Number.isFinite(workload)) return null;
  if (workload <= 0) return null;
  return Math.floor(workload * (1 - MINIMUM_ATTENDANCE) + 1e-9);
}

type AttendanceLevel = 'none' | 'unknown' | 'good' | 'warn' | 'bad';

export type AttendanceSummary = {
  used: number;
  limit: number | null;
  /** Tempos que ainda cabem (negativo: passou do limite). */
  remaining: number | null;
  /** `good` até a metade do limite, `warn` até o limite, `bad` além dele. */
  level: AttendanceLevel;
};

export function attendanceSummary(
  used: number,
  limit: number | null,
): AttendanceSummary {
  if (limit === null) {
    return { used, limit, remaining: null, level: used ? 'unknown' : 'none' };
  }
  const remaining = limit - used;
  let level: AttendanceLevel = 'good';
  if (used === 0) level = 'none';
  else if (remaining < 0) level = 'bad';
  else if (used * 2 >= limit) level = 'warn';
  return { used, limit, remaining, level };
}

/**
 * Aulas que já terminaram nos últimos `days` dias (hoje incluído), da mais
 * recente para a mais antiga.
 */
export function pastMeetings(
  classes: readonly WeeklyClass[],
  now: Date,
  days = 28,
): ClassMeeting[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const meetings: ClassMeeting[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day.setDate(day.getDate() - offset);
    for (const item of classes) {
      if (item.weekday !== day.getDay()) continue;
      if (offset === 0 && item.end > nowMinutes) continue;
      meetings.push({
        subjectId: item.subjectId,
        date: toIsoDate(day),
        start: item.start,
        end: item.end,
        slots: slotCount(item.start, item.end),
      });
    }
  }
  return meetings.sort(byNewest);
}

function byNewest(a: ClassMeeting, b: ClassMeeting): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.start - a.start;
}

/**
 * Aulas recentes de uma disciplina e as faltas mais antigas que já saíram da
 * janela, para que continuem visíveis e possam ser desmarcadas.
 */
export function meetingsWithAbsences(
  meetings: readonly ClassMeeting[],
  absences: readonly Absence[],
  subjectId: string,
): ClassMeeting[] {
  const own = meetings.filter(item => item.subjectId === subjectId);
  const listed = new Set(own.map(absenceKey));
  const older = absences.filter(
    item => item.subjectId === subjectId && !listed.has(absenceKey(item)),
  );
  return [...own, ...older].sort(byNewest);
}
