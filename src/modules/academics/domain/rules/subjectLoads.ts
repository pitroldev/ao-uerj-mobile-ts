import type {
  CurriculumSubject,
  SubjectsTaken,
  UniversalSubject,
} from '../models';
import { normalizeSubjectId } from './subjectId';

export type SubjectLoad = { credits: number | null; workload: number | null };

type Source = { id: string; credits: number | null; workload: number | null };

function keyOf(id: string): string | null {
  try {
    return normalizeSubjectId(id);
  } catch {
    return null;
  }
}

/** Crédito conhecido: 0 vale (atividade sem crédito, fora do CR). */
function isCredits(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

/** Carga horária conhecida: 0 não serve para o limite de faltas. */
function isWorkload(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

/**
 * Créditos e carga horária de cada disciplina, pelo código numérico. As notas
 * e a grade do período não trazem esses números, e o histórico costuma só
 * listar as disciplinas do período quando ele termina. Por isso a ordem é:
 * a tentativa em curso no histórico, o currículo, as universais e, por fim,
 * uma tentativa anterior (quem refaz a disciplina). Cada número vem da
 * primeira fonte que o tem.
 */
export function subjectLoads(
  history: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[] = [],
  universal: readonly UniversalSubject[] = [],
): Map<string, SubjectLoad> {
  const loads = new Map<string, SubjectLoad>();
  const fill = (items: readonly Source[]) => {
    for (const item of items) {
      const key = keyOf(item.id);
      if (key === null) continue;
      const load = loads.get(key) ?? { credits: null, workload: null };
      if (load.credits === null && isCredits(item.credits)) {
        load.credits = item.credits;
      }
      if (load.workload === null && isWorkload(item.workload)) {
        load.workload = item.workload;
      }
      if (load.credits !== null || load.workload !== null) {
        loads.set(key, load);
      }
    }
  };
  fill(history.filter(subject => subject.status === 'IN_PROGRESS'));
  fill(curriculum);
  fill(universal);
  fill(history);
  return loads;
}
