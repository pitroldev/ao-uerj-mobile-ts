/**
 * Situação do portal vista pelo nosso servidor, que o consulta de minutos em
 * minutos: diz se a queda é de todos ou só deste aparelho. Não leva dado de
 * aluno.
 */
export type SharedPortalStatus = {
  state: 'up' | 'down';
  /** Desde quando está assim, quando o servidor sabe. */
  since: number | null;
  /** Última consulta do servidor ao portal. */
  checkedAt: number;
};

/** Uma situação mais velha que isso não diz nada sobre agora. */
const SHARED_STATUS_MAX_AGE = 20 * 60 * 1000;

export function isSharedStatusFresh(
  status: SharedPortalStatus | null,
  now: number,
): status is SharedPortalStatus {
  return status !== null && now - status.checkedAt <= SHARED_STATUS_MAX_AGE;
}
