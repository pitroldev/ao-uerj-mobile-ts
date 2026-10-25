/**
 * Formatação da grade em curso para a apresentação do Início (próxima aula,
 * semana e "Disciplinas em Curso"). Só apresentação: não altera os dados.
 */
import { TIME_VALUES } from '@utils/constants/time';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const WEEKDAY_SHORT = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
] as const;

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Segunda a sábado, como no portal (JS: domingo = 0). */
export const CLASS_DAYS = [1, 2, 3, 4, 5, 6] as const;

/** Dia da semana do JS (0–6) de um item da grade (o portal usa 1–6). */
export function weekdayOf(item: AttendedClassesSchedule): number {
  return item.dayNumber % 7;
}

/** "Terça, 13 de outubro". */
export function dateLabel(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} de ${
    MONTHS[date.getMonth()]
  }`;
}

/** Minutos desde 00:00. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** "11:58", "9:05" (mesmo formato dos tempos da UERJ). */
export function clockLabel(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "T1–T2" ou "T1" quando começa e termina no mesmo tempo. */
export function slotRange(item: AttendedClassesSchedule): string {
  const start = item.periodAlias;
  const end =
    TIME_VALUES.find(t => t.end_time_in_minutes === item.end_time_in_minutes)
      ?.periodAlias ?? start;
  return !end || start === end ? start : `${start}–${end}`;
}

/** "12:20–14:10". */
export function timeRange(item: AttendedClassesSchedule): string {
  return `${item.startTimeAlias}–${item.endTimeAlias}`;
}

const NOT_INFORMED = /^n[aã]o\s+informad[oa]\.?$/i;
const ROOM_NOT_INFORMED = 'Sala não informada';

/** Local da UERJ como veio do portal, ou "Sala não informada". */
export function locationLabel(location?: string | null): string {
  const loc = location?.trim();
  if (!loc || NOT_INFORMED.test(loc)) return ROOM_NOT_INFORMED;
  return loc;
}

/**
 * Separa a sala (último trecho) do restante do local:
 * "Pav. João Lyra Filho · 6º andar · Sala 6019 B" →
 * { room: "Sala 6019 B", place: "Pav. João Lyra Filho · 6º andar" }.
 */
export function splitLocation(location?: string | null): {
  room: string;
  place: string;
} {
  const loc = locationLabel(location);
  if (loc === ROOM_NOT_INFORMED) return { room: loc, place: '' };
  const parts = loc
    .split(/\s+[·•|–—-]\s+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { room: loc, place: '' };
  return {
    room: parts[parts.length - 1],
    place: parts.slice(0, -1).join(' · '),
  };
}

export type Shift = 'morning' | 'afternoon' | 'night';

/** Turno pela hora de início (mesma regra da grade antiga e da imagem). */
export function shiftOf(startMinutes: number): Shift {
  if (startMinutes < 740) return 'morning';
  if (startMinutes < 1070) return 'afternoon';
  return 'night';
}

export function isCanceled(item: AttendedClassesSchedule): boolean {
  return item.class?.status === 'CANCELED';
}

/**
 * Aula com horário conhecido. O portal pode trazer um tempo fora da tabela
 * ("??"), que vira −1; a próxima aula, o widget e as faltas o ignoram.
 */
export function hasClassTime(item: AttendedClassesSchedule): boolean {
  const start = item.start_time_in_minutes;
  const end = item.end_time_in_minutes;
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    end <= 24 * 60
  );
}

/** "Ter e Qui", "Seg, Qua e Sex". */
function joinPt(parts: string[]): string {
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** "2 aulas", "1 aula". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "22 min", "1h05" (mesmo formato do "Livre · 1h50" da agenda). */
export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

const NO_FIXED_TIME = 'Sem horário fixo na grade';

/**
 * Encontros de uma disciplina agrupados pelo mesmo horário:
 * ["Ter e Qui · T1–T2 · 12:20–14:10"]; sem nenhum horário, [NO_FIXED_TIME].
 */
export function meetingSummary(items: AttendedClassesSchedule[]): string[] {
  const timed = items.filter(hasClassTime);
  if (!timed.length) return items.length ? [NO_FIXED_TIME] : [];
  const groups = new Map<
    string,
    { days: number[]; item: AttendedClassesSchedule }
  >();
  timed
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .forEach(item => {
      const key = `${item.start_time_in_minutes}-${item.end_time_in_minutes}`;
      const group = groups.get(key);
      if (group) {
        if (!group.days.includes(item.dayNumber))
          group.days.push(item.dayNumber);
      } else {
        groups.set(key, { days: [item.dayNumber], item });
      }
    });
  return [...groups.values()]
    .sort(
      (a, b) =>
        a.days[0] - b.days[0] ||
        a.item.start_time_in_minutes - b.item.start_time_in_minutes,
    )
    .map(
      ({ days, item }) =>
        `${joinPt(days.map(d => WEEKDAY_SHORT[d % 7]))} · ${slotRange(
          item,
        )} · ${timeRange(item)}`,
    );
}

/** Datas da semana exibida (segunda a sábado). No domingo, a semana que começa. */
export function weekDates(now: Date): Map<number, Date> {
  const today = now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() + (today === 0 ? 1 : 1 - today));
  const dates = new Map<number, Date>();
  CLASS_DAYS.forEach(day => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + day - 1);
    dates.set(day, d);
  });
  return dates;
}

export type NextClass = {
  item: AttendedClassesSchedule;
  /** 0 = hoje, 1 = amanhã… até 7 (o mesmo dia na semana seguinte). */
  dayOffset: number;
  /** Minutos até o início (só hoje). */
  inMinutes: number | null;
  /** Está acontecendo agora. */
  ongoing: boolean;
};

/** Próxima aula (ou a aula em andamento) a partir de `now`, ignorando canceladas. */
export function findNextClass(
  schedule: AttendedClassesSchedule[],
  now: Date,
): NextClass | null {
  const active = schedule.filter(
    item => !isCanceled(item) && hasClassTime(item),
  );
  if (!active.length) return null;
  const today = now.getDay();
  const nowMin = minutesOfDay(now);
  for (let offset = 0; offset <= 7; offset++) {
    const day = (today + offset) % 7;
    const candidates = active
      .filter(
        item =>
          weekdayOf(item) === day &&
          (offset !== 0 || item.end_time_in_minutes > nowMin),
      )
      .sort((a, b) => a.start_time_in_minutes - b.start_time_in_minutes);
    if (candidates.length) {
      const item = candidates[0];
      const inMinutes =
        offset === 0 ? item.start_time_in_minutes - nowMin : null;
      return {
        item,
        dayOffset: offset,
        inMinutes,
        ongoing: inMinutes !== null && inMinutes <= 0,
      };
    }
  }
  return null;
}
