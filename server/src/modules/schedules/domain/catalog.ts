import {
  canShareSchedule,
  fitsAvailability,
  type PlacedClass,
} from './compatibility.ts';
import type { GenerationRequest, Interval } from './model.ts';

/** Uma turma que pode entrar em alguma grade. */
export type Candidate = PlacedClass & {
  /** A posição no catálogo. */
  position: number;
  /** A posição em `request.classes`. */
  classIndex: number;
  /** A posição da disciplina em `request.subjects`. */
  subjectIndex: number;
  /** A turma na identidade da grade. */
  key: string;
};

/**
 * Como o servidor antigo identificava uma turma na grade: a disciplina, um
 * "x" e os horários na ordem recebida. O número da turma não entra.
 */
const classKey = (subjectId: string, intervals: readonly Interval[]) =>
  `${subjectId}x${intervals.map(i => `D${i.day}-${i.start}-${i.end}`).join('')}`;

/**
 * A identidade da grade: as chaves das turmas, em ordem, unidas por "-".
 * Duas turmas da mesma disciplina no mesmo horário dão a mesma grade.
 */
export const scheduleIdentity = (classes: readonly Candidate[]): string =>
  classes
    .map(option => option.key)
    .sort()
    .join('-');

/** As turmas que podem entrar em alguma grade e o que a busca consulta a cada passo. */
export type Catalog = {
  /** Na ordem do pedido: a ordem decide o desempate. */
  readonly candidates: readonly Candidate[];
  /** As turmas nas posições `a` e `b` cabem na mesma grade. */
  compatible(a: number, b: number): boolean;
  /** Quantas disciplinas há da posição `from` em diante: o máximo que um ramo dali ainda soma. */
  subjectsFrom(from: number): number;
};

/**
 * Monta o catálogo do pedido: cada turma com a primeira disciplina de mesmo
 * código, sem as de disciplina desconhecida e as que batem com um horário
 * ocupado. A compatibilidade entre cada par fica calculada de antemão.
 */
export function buildCatalog(request: GenerationRequest): Catalog {
  const subjectIndexById = new Map<string, number>();
  request.subjects.forEach((subject, index) => {
    if (!subjectIndexById.has(subject.id))
      subjectIndexById.set(subject.id, index);
  });

  const candidates: Candidate[] = [];
  request.classes.forEach((option, classIndex) => {
    const subjectIndex = subjectIndexById.get(option.subjectId);
    if (subjectIndex === undefined) return;
    if (!fitsAvailability(option, request.busy)) return;
    candidates.push({
      position: candidates.length,
      classIndex,
      subjectIndex,
      subject: request.subjects[subjectIndex],
      intervals: option.intervals,
      key: classKey(option.subjectId, option.intervals),
    });
  });

  const size = candidates.length;
  const clashes = new Uint8Array(size * size);
  for (let a = 0; a < size; a++)
    for (let b = a + 1; b < size; b++)
      if (!canShareSchedule(candidates[a], candidates[b])) {
        clashes[a * size + b] = 1;
        clashes[b * size + a] = 1;
      }

  const subjectsFrom = new Int32Array(size + 1);
  const seen = new Set<string>();
  for (let position = size - 1; position >= 0; position--) {
    seen.add(candidates[position].subject.id);
    subjectsFrom[position] = seen.size;
  }

  return {
    candidates,
    compatible: (a, b) => clashes[a * size + b] === 0,
    subjectsFrom: from => subjectsFrom[from],
  };
}
