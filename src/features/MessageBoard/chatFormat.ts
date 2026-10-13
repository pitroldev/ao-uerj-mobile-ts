import type { Message } from '@root/modules/community/domain/models';

/** Formatação das conversas do mural (datas, horas, agrupamento por dia). */

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
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
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

export function messageDate(createdAt: string): Date | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "21:14" (hora local). */
export function timeLabel(date: Date | null): string {
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
}

/** "12/10/2026". */
function shortDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`;
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** "Hoje", "Ontem", "Sexta, 9 de outubro" (com o ano quando não é o atual). */
export function dayLabel(date: Date | null, now: Date): string {
  if (!date) return 'Data desconhecida';
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const label = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${
    MONTHS[date.getMonth()]
  }`;
  return date.getFullYear() === now.getFullYear()
    ? label
    : `${label} de ${date.getFullYear()}`;
}

function dayKey(date: Date | null): string {
  return date
    ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    : 'sem-data';
}

export type DayGroup = {
  key: string;
  label: string;
  messages: Message[];
};

/**
 * Agrupa mensagens consecutivas do mesmo dia, sem mudar a ordem recebida:
 * cada grupo vira um separador de data seguido das suas mensagens.
 */
export function groupByDay(messages: Message[], now: Date): DayGroup[] {
  const groups: (DayGroup & { day: string })[] = [];
  for (const message of messages) {
    const date = messageDate(message.createdAt);
    const day = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.messages.push(message);
    } else {
      groups.push({
        key: `${day}#${groups.length}`,
        day,
        label: dayLabel(date, now),
        messages: [message],
      });
    }
  }
  return groups;
}

const normalizeName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/** As mensagens do aluno saem com o nome da conta (veja `Community.postMessage`). */
export function isOwnMessage(
  message: Pick<Message, 'authorName'>,
  accountName: string | null | undefined,
): boolean {
  if (!accountName?.trim()) return false;
  return normalizeName(message.authorName) === normalizeName(accountName);
}

/** "5 mensagens · última em 12/10/2026" ou "Nenhuma mensagem ainda". */
export function threadSummary(messages: Message[]): string {
  if (!messages.length) return 'Nenhuma mensagem ainda';
  const count =
    messages.length === 1 ? '1 mensagem' : `${messages.length} mensagens`;
  const dates = messages
    .map(message => messageDate(message.createdAt))
    .filter((date): date is Date => date !== null);
  if (!dates.length) return count;
  const latest = new Date(Math.max(...dates.map(date => date.getTime())));
  return `${count} · última em ${shortDate(latest)}`;
}

/** Primeiro link http(s) do texto, para a ação acessível "Abrir link". */
export function firstLink(text: string): string | null {
  const match = /https?:\/\/[^\s]+/i.exec(text);
  return match ? match[0] : null;
}
