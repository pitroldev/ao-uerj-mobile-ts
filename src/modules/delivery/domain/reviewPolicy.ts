const DAY = 24 * 60 * 60 * 1000;

/** Uso acumulado para decidir se já dá para pedir a avaliação na loja. */
export type ReviewHistory = {
  /** Primeira sessão com a conta carregada. */
  firstSessionAt: number;
  /** Sessões (aberturas do app) em que a conta carregou. */
  sessions: number;
  lastRequestAt: number | null;
};

export const REVIEW_MIN_USE = 3 * DAY;
export const REVIEW_MIN_SESSIONS = 4;
/** No máximo um pedido a cada 120 dias (a loja ainda aplica a própria cota). */
export const REVIEW_INTERVAL = 120 * DAY;

export function recordSession(
  history: ReviewHistory | null,
  now: number,
): ReviewHistory {
  return history
    ? { ...history, sessions: history.sessions + 1 }
    : { firstSessionAt: now, sessions: 1, lastRequestAt: null };
}

export function canRequestReview(
  history: ReviewHistory | null,
  now: number,
): boolean {
  if (!history) return false;
  return (
    now - history.firstSessionAt >= REVIEW_MIN_USE &&
    history.sessions >= REVIEW_MIN_SESSIONS &&
    (history.lastRequestAt === null ||
      now - history.lastRequestAt >= REVIEW_INTERVAL)
  );
}

/** Lê a cópia salva sem confiar no formato. */
export function parseReviewHistory(raw: unknown): ReviewHistory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { firstSessionAt, sessions, lastRequestAt } = raw as Record<
    string,
    unknown
  >;
  const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  if (!finite(firstSessionAt) || !finite(sessions)) return null;
  if (lastRequestAt !== null && !finite(lastRequestAt)) return null;
  return { firstSessionAt, sessions, lastRequestAt };
}
