import { EVALUATIONS_KEY } from '../application/EvaluationRecords';

/**
 * Chave das avaliações da conta e do período no cache das consultas (a mesma
 * forma das outras preferências da conta, como as faltas).
 */
export function evaluationsQueryKey(scope: string | undefined, period: string) {
  return ['preferences', scope ?? 'signed-out', EVALUATIONS_KEY, period];
}
