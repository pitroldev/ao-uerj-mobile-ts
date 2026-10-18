const HOUR = 60 * 60 * 1000;

/** Intervalo da verificação periódica no Aluno Online (o Android pode atrasar). */
export const CHECK_INTERVAL_HOURS = 4;
/** Depois de bloqueio ou limite de consultas, o portal fica em paz por um tempo. */
export const PAUSE_AFTER_REFUSAL = 12 * HOUR;
/** Documentos e grade mudam pouco: no máximo uma consulta por dia. */
export const DAILY_INTERVAL = 20 * HOUR;
/** Antecedência do aviso de documento perto de vencer. */
export const DOCUMENT_NOTICE_DAYS = 3;
/** Só avisa vias recentes; a lista não cresce sem limite. */
const MAX_NOTIFIED_DOCUMENTS = 20;
/** Sem consultas nem avisos do portal das 22h às 7h. */
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

export type CheckOutcome =
  'ok' | 'blocked' | 'unavailable' | 'offline' | 'failed' | 'signed-out';

/** Estado da verificação em segundo plano, por conta. */
export type CheckState = {
  /** Última verificação que chegou ao portal (ms). */
  lastRunAt: number | null;
  lastOutcome: CheckOutcome | null;
  /** Sem consultas até este instante (ms), depois de uma recusa do portal. */
  pausedUntil: number | null;
  documentsCheckedAt: number | null;
  /** Vias já avisadas (`documentNoticeKey`). */
  notifiedDocuments: string[];
};

export const EMPTY_CHECK_STATE: CheckState = {
  lastRunAt: null,
  lastOutcome: null,
  pausedUntil: null,
  documentsCheckedAt: null,
  notifiedDocuments: [],
};

const OUTCOMES: readonly CheckOutcome[] = [
  'ok',
  'blocked',
  'unavailable',
  'offline',
  'failed',
  'signed-out',
];

export function normalizeCheckState(raw: unknown): CheckState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return EMPTY_CHECK_STATE;
  const value = raw as Record<string, unknown>;
  const time = (key: string) =>
    typeof value[key] === 'number' && Number.isFinite(value[key])
      ? value[key]
      : null;
  return {
    lastRunAt: time('lastRunAt'),
    lastOutcome: OUTCOMES.includes(value.lastOutcome as CheckOutcome)
      ? (value.lastOutcome as CheckOutcome)
      : null,
    pausedUntil: time('pausedUntil'),
    documentsCheckedAt: time('documentsCheckedAt'),
    notifiedDocuments: Array.isArray(value.notifiedDocuments)
      ? value.notifiedDocuments
          .filter((key): key is string => typeof key === 'string')
          .slice(-MAX_NOTIFIED_DOCUMENTS)
      : [],
  };
}

export function rememberDocuments(
  notified: readonly string[],
  keys: readonly string[],
): string[] {
  return [...new Set([...notified, ...keys])].slice(-MAX_NOTIFIED_DOCUMENTS);
}

/** Das 22h às 7h (hora do aparelho) o app não consulta o portal. */
export function isQuietTime(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

export function isDue(lastAt: number | null, now: number, interval: number) {
  return lastAt === null || now - lastAt >= interval || now < lastAt;
}
