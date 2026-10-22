/**
 * Disponibilidade do Aluno Online vista pelo app. Sem internet não é queda
 * do portal: quem decide isso é o monitor, que só registra falhas com o
 * aparelho conectado.
 */
export type PortalAvailability = {
  /** `down`: o portal falhou com a internet funcionando. */
  state: 'up' | 'down';
  /** Primeira falha da queda atual. */
  since: number | null;
  /** Tentativas que falharam depois da queda (definem a espera). */
  attempts: number;
  /** Falhas de rede seguidas ainda sem queda (uma pode ser a rede do aluno). */
  strikes: number;
  /** Quando as leituras voltam a ser tentadas. */
  retryAt: number | null;
  /** O portal respondeu, mas devagar. */
  slow: boolean;
};

/** Falha de rede (sem resposta no prazo) ou o portal respondendo que está fora. */
export type PortalFailure = 'network' | 'unavailable';

export const PORTAL_UP: PortalAvailability = {
  state: 'up',
  since: null,
  attempts: 0,
  strikes: 0,
  retryAt: null,
  slow: false,
};

/** Esperas entre tentativas: 1, 2, 5, 10 e depois 15 min. */
export const RETRY_WAITS = [60_000, 120_000, 300_000, 600_000, 900_000];
/** Resposta mais demorada que isso marca o portal como lento. */
export const SLOW_RESPONSE_MS = 8_000;
/** Falhas de rede seguidas que contam como queda; o portal recusando conta na hora. */
const NETWORK_STRIKES = 2;

const wait = (attempts: number) =>
  RETRY_WAITS[Math.min(attempts, RETRY_WAITS.length - 1)];

export function portalFailed(
  current: PortalAvailability,
  failure: PortalFailure,
  now: number,
): PortalAvailability {
  if (current.state === 'down') {
    const attempts = current.attempts + 1;
    return { ...current, attempts, retryAt: now + wait(attempts) };
  }
  const strikes = current.strikes + 1;
  if (failure === 'network' && strikes < NETWORK_STRIKES)
    return { ...current, strikes };
  return {
    state: 'down',
    since: now,
    attempts: 0,
    strikes: 0,
    retryAt: now + wait(0),
    slow: false,
  };
}

export function portalResponded(durationMs: number): PortalAvailability {
  return { ...PORTAL_UP, slow: durationMs >= SLOW_RESPONSE_MS };
}

/** Uma leitura pode ir ao portal agora? Fora do ar, só depois da espera. */
export function canTryPortal(
  current: PortalAvailability,
  now: number,
): boolean {
  return (
    current.state === 'up' ||
    (current.retryAt !== null && now >= current.retryAt)
  );
}
