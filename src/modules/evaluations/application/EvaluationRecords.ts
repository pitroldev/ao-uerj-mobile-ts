import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import {
  isEvaluation,
  markDone,
  removeEvaluation,
  setEvaluation,
  type Evaluation,
} from '../domain/evaluations';

/** Chave das avaliações nas preferências da conta (o logout a apaga). */
export const EVALUATIONS_KEY = 'evaluations';

/** Avaliações por período letivo ("2026.1"): trocar de período começa do zero. */
type StoredEvaluations = { version: 1; periods: Record<string, Evaluation[]> };

function periodsOf(stored: unknown): Record<string, Evaluation[]> {
  const periods = (stored as StoredEvaluations | null)?.periods;
  return periods && typeof periods === 'object' ? periods : {};
}

function evaluationsOf(stored: unknown, period: string): Evaluation[] {
  const list = periodsOf(stored)[period];
  return Array.isArray(list) ? list.filter(isEvaluation) : [];
}

/**
 * Datas de provas e trabalhos anotadas pelo aluno, só no aparelho. Cada
 * mudança lê e grava na mesma vez da fila da chave: duas mudanças seguidas
 * não se sobrescrevem, e a remoção do logout não cai entre as duas.
 */
export class EvaluationRecords {
  constructor(private readonly store: PreferencesStore) {}

  async read(scope: string, period: string): Promise<Evaluation[]> {
    return evaluationsOf(await this.store.read(scope, EVALUATIONS_KEY), period);
  }

  /** Grava (ou troca) a avaliação; a prova repetida da disciplina sai. */
  save(
    scope: string,
    period: string,
    evaluation: Evaluation,
  ): Promise<Evaluation[]> {
    return this.change(scope, period, list => setEvaluation(list, evaluation));
  }

  remove(scope: string, period: string, id: string): Promise<Evaluation[]> {
    return this.change(scope, period, list => removeEvaluation(list, id));
  }

  /** "Já fiz" pelo aviso, ou desfazer na folha. */
  setDone(
    scope: string,
    period: string,
    ids: readonly string[],
    done: boolean,
  ): Promise<Evaluation[]> {
    return this.change(scope, period, list => markDone(list, ids, done));
  }

  private async change(
    scope: string,
    period: string,
    change: (list: Evaluation[]) => Evaluation[],
  ): Promise<Evaluation[]> {
    const stored = await this.store.update<StoredEvaluations>(
      scope,
      EVALUATIONS_KEY,
      current => ({
        version: 1,
        periods: {
          ...periodsOf(current),
          [period]: change(evaluationsOf(current, period)),
        },
      }),
    );
    return stored.periods[period];
  }
}
