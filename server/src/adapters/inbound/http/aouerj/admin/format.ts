/* As datas e os números da administração, no fuso da UERJ. */

export const ZONE = 'America/Sao_Paulo';
export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const dayMonthFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
});
const stampFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const longDayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** O dia de São Paulo, AAAA-MM-DD. */
export const dayKey = (date: Date) => dayKeyFormat.format(date);
/** "15:28". */
export const hour = (date: Date) => hourFormat.format(date);
/** "19/11". */
export const dayMonth = (date: Date) => dayMonthFormat.format(date);
/** "19/11/2026, 15:28". */
export const stamp = (date: Date) => stampFormat.format(date);
/** "quinta-feira, 19 de novembro". */
export const longDay = (date: Date) => longDayFormat.format(date);
/** "qui, 19/11" a partir de "2026-11-19", no meio do dia de São Paulo. */
export const statDay = (day: string) =>
  weekdayFormat.format(new Date(`${day}T12:00:00-03:00`)).replace('.', '');

/** "15:28" hoje, "ontem, 15:28" ou "qui, 12/11, 15:28". */
export function when(date: Date, now: Date) {
  const key = dayKey(date);
  if (key === dayKey(now)) return hour(date);
  if (key === dayKey(new Date(now.getTime() - DAY_MS)))
    return `ontem, ${hour(date)}`;
  return `${weekdayFormat.format(date).replace('.', '')}, ${hour(date)}`;
}

/** Quanto faz: "agora", "12 min", "3 h", "2 d". */
export function ago(date: Date, now: Date) {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / MINUTE_MS),
  );
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (60 * 24))} d`;
}

/** "1 relato", "12 relatos". */
export const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

/** Quanto `part` é de `total` ("62%"); vazio sem total. */
export const percent = (part: number, total: number) =>
  total ? `${Math.round((part * 100) / total)}%` : '';

export const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** O nome do portal vem em maiúsculas; a administração mostra como se escreve. */
export const nameCase = (name: string) =>
  name
    .toLocaleLowerCase('pt-BR')
    .replace(
      /(^|\s)(\S)/g,
      (_, space: string, letter: string) =>
        space + letter.toLocaleUpperCase('pt-BR'),
    )
    .replace(/\b(Dos|Das|De|Da|Do|E)\b/g, word => word.toLowerCase());

/** O primeiro nome, para as frases curtas ("Pedro perde os pontos"). */
export const firstName = (name: string) => nameCase(name).split(' ')[0] ?? '';

/** Um texto longo numa linha só, cortado numa palavra. */
export function excerpt(text: string, max = 90) {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= max) return line;
  const space = line.lastIndexOf(' ', max);
  return `${line.slice(0, space > max * 0.6 ? space : max)}…`;
}
