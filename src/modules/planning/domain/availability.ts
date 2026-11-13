import type {
  CurriculumSubject,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';

import { lunchBreak } from './lunch';
import {
  classKey,
  type GeneratorDraft,
  type ScheduleCreationParams,
} from './models';
import { availableClasses } from './rules';

/**
 * Uma disciplina escolhida, com o que o Aluno Online disse dela:
 * - `loading`: lendo as turmas;
 * - `failed`: a leitura falhou (dá para tentar de novo);
 * - `refused`: o aluno não pode cursá-la (pré-requisito ou créditos);
 * - `ready`: pode entrar; `details.classes` vazio = sem turma no período.
 */
export type SubjectAvailability =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'refused'; reason: string; details: SubjectInfo }
  | { status: 'ready'; details: SubjectInfo };

/** O teto de disciplinas que o gerador aceita numa grade. */
const MAX_SUBJECTS_IN_SCHEDULE = 12;

/** As disciplinas que podem entrar, com as turmas lidas. */
export function readySubjects(
  draft: Pick<GeneratorDraft, 'selectedSubjects'>,
  availability: ReadonlyMap<string, SubjectAvailability>,
): SubjectInfo[] {
  return draft.selectedSubjects.flatMap(subject => {
    const state = availability.get(subject.id);
    return state?.status === 'ready' && state.details.classes?.length
      ? [state.details]
      : [];
  });
}

/**
 * O pedido de geração a partir das escolhas do aluno: as disciplinas que
 * podem entrar, as turmas que cabem na rotina (menos as que ele tirou) e,
 * sem teto escolhido, todas as disciplinas.
 */
export function assembleGeneration({
  draft,
  availability,
  history,
  curriculum,
}: {
  draft: GeneratorDraft;
  availability: ReadonlyMap<string, SubjectAvailability>;
  history: readonly SubjectsTaken[];
  curriculum?: readonly CurriculumSubject[];
}): ScheduleCreationParams {
  const subjects = readySubjects(draft, availability);
  const lunch = lunchBreak(draft.lunchMinutes);
  const removed = new Set(draft.removedClasses);
  const selectedClasses = availableClasses(
    subjects,
    draft.busy_schedules,
    lunch,
  ).filter(group => !removed.has(classKey(group)));
  const ceiling = Math.min(MAX_SUBJECTS_IN_SCHEDULE, subjects.length);
  return {
    min_subject_amount: 1,
    max_subject_amount: Math.max(
      1,
      Math.min(draft.maxSubjects ?? ceiling, ceiling),
    ),
    busy_schedules: draft.busy_schedules,
    lunch,
    priority: draft.priority,
    selectedSubjects: draft.selectedSubjects,
    takenSubjects: [...history],
    curriculumSubjects: curriculum ? [...curriculum] : undefined,
    subjects,
    selectedClasses,
  };
}
