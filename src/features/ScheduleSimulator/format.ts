import { TIME_VALUES, WEEKDAY_DICTIONARY } from '@utils/constants/time';
import type { Horario, WeekDay } from '@root/modules/academics/domain/models';
import type { Schedule } from '@root/modules/planning/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { PORTAL_BLOCKED_FULL_TEXT } from '@components/ui/Feedback/blockedText';

/** Rótulos do trilho de passos do gerador. */
export const STEP_LABELS = [
  'Qtd. Disciplinas',
  'Horários Ocupados',
  'Prioridades',
  'Selecionar Disciplinas',
  'Carregar Dados',
  'Turmas',
  'Gerar Grade',
];

export type TimeSlot = (typeof TIME_VALUES)[number];

/** Tempos de aula da UERJ (M1–N5), sem o marcador "??". */
export const TIME_SLOTS: TimeSlot[] = TIME_VALUES.filter(
  time => time.start_time_in_minutes > 0,
);

/** Texto real do app para o portal bloqueado sem dados salvos. */
export const BLOCKED_TEXT = PORTAL_BLOCKED_FULL_TEXT;

export function isPortalBlocked(error: unknown): boolean {
  return error instanceof AppError && error.code === 'POSSIBLY_BLOCKED';
}

/** "1 tempo", "8 tempos". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Seg", "Seg e Qua", "Seg, Qua e Sex". */
export function joinPt(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** "M3–M4" ou só "M3" quando é um tempo. */
export function slotRange(from: string, to: string): string {
  return from === to ? from : `${from}–${to}`;
}

/** Primeira letra minúscula, para emendar um motivo numa frase. */
export function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

const WEEK_ORDER: WeekDay[] = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];

const WEEKDAYS = Object.values(WEEKDAY_DICTIONARY);

function shortDay(name: string): string {
  return WEEKDAYS.find(day => day.name === name)?.shortName ?? name;
}

/** Dia da semana do gerador (0 = segunda) para o dicionário (1 = segunda). */
export function planningDay(weekDay: number) {
  return WEEKDAY_DICTIONARY[(weekDay + 1) as keyof typeof WEEKDAY_DICTIONARY];
}

type Meeting = { day: number; dayLabel: string; from: string; to: string };

/** Agrupa encontros com o mesmo intervalo: "Seg e Qua · M3–M4". */
function summarize(meetings: Meeting[], times?: Map<string, string>): string {
  const groups = new Map<
    string,
    { from: string; to: string; days: string[] }
  >();
  [...meetings]
    .sort((a, b) => a.day - b.day)
    .forEach(meeting => {
      const key = `${meeting.from}-${meeting.to}`;
      const group = groups.get(key) ?? {
        from: meeting.from,
        to: meeting.to,
        days: [],
      };
      if (!group.days.includes(meeting.dayLabel))
        group.days.push(meeting.dayLabel);
      groups.set(key, group);
    });
  return [...groups.entries()]
    .map(([key, group]) => {
      const time = times?.get(key);
      return [joinPt(group.days), slotRange(group.from, group.to), time]
        .filter(Boolean)
        .join(' · ');
    })
    .join('; ');
}

/**
 * Encontros de uma turma do portal ("Seg e Qua · M3–M4"), a partir do
 * `Horario[]` que vem dos detalhes da disciplina.
 */
export function classMeetings(schedule: Horario[] | undefined): string {
  const meetings: Meeting[] = [];
  (schedule ?? []).forEach(entry => {
    (Object.keys(entry) as WeekDay[]).forEach(day => {
      (entry[day] ?? []).forEach(group => {
        if (!group.length) return;
        meetings.push({
          day: WEEK_ORDER.indexOf(day),
          dayLabel: shortDay(day),
          from: group[0],
          to: group[group.length - 1],
        });
      });
    });
  });
  return summarize(meetings);
}

/** Índice do tempo que contém o início (o primeiro que começa até ali). */
export function slotIndexAtStart(minutes: number): number {
  let found = 0;
  TIME_SLOTS.forEach((slot, index) => {
    if (slot.start_time_in_minutes <= minutes) found = index;
  });
  return found;
}

/** Índice do tempo que contém o fim (o primeiro que termina a partir dali). */
export function slotIndexAtEnd(minutes: number): number {
  const index = TIME_SLOTS.findIndex(
    slot => slot.end_time_in_minutes >= minutes,
  );
  return index < 0 ? TIME_SLOTS.length - 1 : index;
}

/**
 * Encontros de uma turma gerada, com horário:
 * "Seg e Qua · M3–M4 · 8:50–10:30".
 */
export function scheduleMeetings(schedules: Schedule[]): string {
  const times = new Map<string, string>();
  const meetings = schedules.map(item => {
    const from = TIME_SLOTS[slotIndexAtStart(item.start_time_in_minutes)];
    const to = TIME_SLOTS[slotIndexAtEnd(item.end_time_in_minutes)];
    times.set(
      `${from.periodAlias}-${to.periodAlias}`,
      `${from.startTimeAlias}–${to.endTimeAlias}`,
    );
    return {
      day: item.week_day,
      dayLabel: planningDay(item.week_day)?.shortName ?? '?',
      from: from.periodAlias,
      to: to.periodAlias,
    };
  });
  return summarize(meetings, times);
}

/** Turno pelo início da aula (mesmos limites da grade antiga). */
export function shiftOfMinutes(
  minutes: number,
): 'morning' | 'afternoon' | 'night' {
  if (minutes < 740) return 'morning';
  if (minutes < 1070) return 'afternoon';
  return 'night';
}

const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'para',
  'a',
  'o',
]);
const NUMERAL = /^(?:[IVX]+|\d+)$/;

/** Sigla de uma disciplina: "Desenvolvimento para Dispositivos Móveis" → "DDM". */
export function acronym(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/g, ''))
    .filter(word => word && !STOP_WORDS.has(word.toLowerCase()))
    .map(word => (NUMERAL.test(word) ? word : word.charAt(0).toUpperCase()))
    .join('');
}

/** Siglas únicas por chave (repetidas ganham um número: "CG", "CG2"). */
export function uniqueAcronyms(
  items: { key: string; name: string }[],
): Map<string, string> {
  const used = new Map<string, number>();
  const result = new Map<string, string>();
  items.forEach(item => {
    if (result.has(item.key)) return;
    const base = acronym(item.name) || '?';
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    result.set(item.key, count === 1 ? base : `${base}${count}`);
  });
  return result;
}
