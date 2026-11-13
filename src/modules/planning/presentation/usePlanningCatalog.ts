import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import {
  useCurriculum,
  useHistory,
  useSubjectDetailsList,
} from '@root/modules/academics/presentation/queries';

import type { SubjectAvailability } from '../domain/availability';
import { refusalText, subjectEligibility } from '../domain/rules';

const NO_CURRICULUM: readonly CurriculumSubject[] = [];

/**
 * O que o Aluno Online diz de cada disciplina escolhida: as turmas e se o
 * aluno pode cursá-la. Cada disciplina tem a própria consulta (em cache por
 * horas), então marcar mais uma não refaz as outras.
 */
export function usePlanningCatalog(selected: readonly CurriculumSubject[]) {
  const history = useHistory();
  const curriculum = useCurriculum();
  const details = useSubjectDetailsList(selected.map(subject => subject.id));
  const completed = curriculum.data ?? NO_CURRICULUM;

  const availability = new Map<string, SubjectAvailability>();
  let loading = 0;
  let failed = 0;
  selected.forEach((subject, index) => {
    const query = details[index];
    if (query?.data && history.data) {
      const { eligible } = subjectEligibility(
        subject,
        query.data,
        history.data,
        completed,
      );
      availability.set(
        subject.id,
        eligible
          ? { status: 'ready', details: query.data }
          : {
              status: 'refused',
              reason: refusalText(subject, query.data, history.data, completed),
              details: query.data,
            },
      );
    } else if ((query?.error && !query.data) || history.error) {
      failed += 1;
      availability.set(subject.id, { status: 'failed' });
    } else {
      loading += 1;
      availability.set(subject.id, { status: 'loading' });
    }
  });

  const retry = () => {
    if (history.error) void history.refetch();
    details.forEach(query => {
      if (query.error && !query.data) void query.refetch();
    });
  };

  return {
    availability,
    /** Disciplinas ainda sendo lidas e as que falharam. */
    loading,
    failed,
    retry,
    history,
    curriculum,
  };
}
