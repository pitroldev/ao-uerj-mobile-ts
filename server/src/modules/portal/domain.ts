/**
 * A situação do Aluno Online vista daqui: no ar, fora ou ainda sem consulta,
 * desde quando e a última consulta. Nada de aluno.
 */

export type PortalState = 'up' | 'down' | 'unknown';

export type PortalStatus = {
  state: PortalState;
  /** Desde quando (ms). */
  since: number | null;
  /** A última consulta (ms). */
  checkedAt: number | null;
};

export const INITIAL_STATUS: PortalStatus = {
  state: 'unknown',
  since: null,
  checkedAt: null,
};

/** Respostas de gateway e manutenção: o portal está fora do ar. */
const UNAVAILABLE = new Set([502, 503, 504]);

/**
 * O portal respondeu algo que não é queda (um redirecionamento conta);
 * `null` é a falta de resposta.
 */
export function isUp(httpStatus: number | null): boolean {
  return httpStatus !== null && !UNAVAILABLE.has(httpStatus);
}

/** O estado depois de uma consulta: o início só muda quando o estado muda. */
export function nextStatus(
  previous: PortalStatus,
  up: boolean,
  at: number,
): PortalStatus {
  const state: PortalState = up ? 'up' : 'down';
  return {
    state,
    since: state === previous.state ? previous.since : at,
    checkedAt: at,
  };
}
