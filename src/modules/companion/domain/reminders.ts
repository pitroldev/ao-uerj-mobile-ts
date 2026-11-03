import type { Membership } from './companion';

/*
 * Os avisos da Companhia agora ficam no aparelho, agendados a partir das
 * participações guardadas: 10 minutos antes do encontro e, na volta, 40
 * minutos depois da saída, o convite para avisar que chegou. Nada passa por
 * um servidor de avisos (o app não tem push): quem entra e os recados
 * aparecem com o app aberto.
 */

const MINUTE = 60 * 1000;
/** O aviso de antes do encontro. */
const SOON_LEAD_MS = 10 * MINUTE;
/** O "Chegou bem?" depois da saída. */
const ARRIVED_AFTER_MS = 40 * MINUTE;

export type CompanionReminderKey = 'soon' | 'arrived';

/** Os horários do aviso como hora local ("2026-11-23T22:05"). */
type WallTimes = { at: string; until: string };

type CompanionReminder = {
  /** Chamada, aviso e horário: o aparelho mostra cada um uma vez só. */
  id: string;
  callId: string;
  /** Quando o aviso aparece (ms). */
  at: number;
  /** Depois disso o texto já não vale e o aviso não aparece. */
  until: number;
  local: WallTimes;
  title: string;
  body: string;
};

/** O que fica agendado no aparelho; o plano novo substitui o anterior. */
export type CompanionReminderPlan = { reminders: CompanionReminder[] };

/** Cada participação tem até dois avisos, e o app tem poucas de uma vez. */
const MAX_COMPANION_REMINDERS = 8;

export type CompanionReminderText = (
  membership: Membership,
  key: CompanionReminderKey,
) => { title: string; body: string };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** "2026-11-23T22:05", na hora local. */
function wall(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Os avisos que ainda vão chegar, do mais próximo ao mais distante. O texto
 * vem de fora: a apresentação sabe o nome de cada ponto de encontro.
 */
export function buildCompanionReminderPlan(
  memberships: readonly Membership[],
  { now, text }: { now: number; text: CompanionReminderText },
): CompanionReminderPlan {
  const reminders = memberships.flatMap(membership => {
    const items: { key: CompanionReminderKey; at: number; until: number }[] = [
      { key: 'soon', at: membership.at - SOON_LEAD_MS, until: membership.at },
    ];
    if (membership.kind === 'home')
      items.push({
        key: 'arrived',
        at: membership.at + ARRIVED_AFTER_MS,
        until: membership.expiresAt,
      });
    return (
      items
        // entrou já dentro dos 10 minutos: o aviso de antes não vem; o
        // "Chegou bem?" atrasado (o app fechado) ainda vale até sumir
        .filter(
          item =>
            item.until > now &&
            item.at < item.until &&
            (item.key !== 'soon' || item.at >= now),
        )
        .map(item => {
          const at = Math.max(item.at, now);
          return {
            id: `${membership.callId}:${item.key}@${item.at}`,
            callId: membership.callId,
            at,
            until: item.until,
            local: { at: wall(at), until: wall(item.until) },
            ...text(membership, item.key),
          };
        })
    );
  });
  return {
    reminders: reminders
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX_COMPANION_REMINDERS),
  };
}
