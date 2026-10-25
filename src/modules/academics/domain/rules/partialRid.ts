import type { PartialRidResult } from '../models';

const DAY = 24 * 60 * 60 * 1000;
/**
 * Durante a inscrição o portal atualiza o RID Parcial todo dia. Passado esse
 * prazo da última atualização, ele é o retrato de uma inscrição que já
 * acabou (o portal o mantém no menu o período inteiro).
 */
const CURRENT_RID_DAYS = 30;

/** "03/03/2026" (o portal escreve com espaços em volta); fora disso, `null`. */
export function ridUpdatedAt(text: string): Date | null {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 ? date : null;
}

/**
 * O RID Parcial é o da inscrição em curso: tem disciplinas e foi atualizado
 * há no máximo 30 dias. Sem data legível, vale (como antes).
 */
export function isCurrentPartialRid(
  rid: PartialRidResult | undefined,
  now: Date,
): boolean {
  if (!rid?.subjects.length) return false;
  const updated = ridUpdatedAt(rid.updatedAt);
  return (
    !updated || now.getTime() - updated.getTime() <= CURRENT_RID_DAYS * DAY
  );
}

/** Há um RID Parcial, mas de uma inscrição que já acabou. */
export function isPastPartialRid(
  rid: PartialRidResult | undefined,
  now: Date,
): boolean {
  return Boolean(rid?.subjects.length) && !isCurrentPartialRid(rid, now);
}
