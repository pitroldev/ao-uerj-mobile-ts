import { subjectLoads } from '../subjectLoads';
import type {
  CurriculumSubject,
  SubjectsTaken,
  UniversalSubject,
} from '../../models';

const course = (fields: Partial<SubjectsTaken> = {}): SubjectsTaken => ({
  id: 'IME01-00100',
  name: 'Cálculo I',
  period: '2025/1',
  credits: 6,
  workload: 90,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});
const listed = (
  fields: Partial<CurriculumSubject> = {},
): CurriculumSubject => ({
  id: 'IME02-00778',
  name: 'Física Experimental II',
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
  ...fields,
});
const universal = (
  fields: Partial<UniversalSubject> = {},
): UniversalSubject => ({
  id: 'FIL01-00900',
  name: 'Ética',
  type: 'UNIVERSAL',
  credits: 2,
  workload: 30,
  ...fields,
});

it('maps credits and workload by numeric subject code', () => {
  const loads = subjectLoads([course()], [listed()], [universal()]);
  expect(loads.get('100')).toEqual({ credits: 6, workload: 90 });
  expect(loads.get('778')).toEqual({ credits: 4, workload: 60 });
  expect(loads.get('900')).toEqual({ credits: 2, workload: 30 });
});

it('prefers the attempt in progress, then the curriculum, then older attempts', () => {
  const loads = subjectLoads(
    [
      course({ status: 'FAILED_BY_GRADE', workload: 60 }),
      course({ status: 'IN_PROGRESS', workload: 90, grade: null }),
      course({ id: 'IME02-00778', status: 'FAILED_BY_GRADE', workload: 45 }),
    ],
    [listed({ workload: 60 })],
  );
  expect(loads.get('100')).toEqual({ credits: 6, workload: 90 });
  expect(loads.get('778')).toEqual({ credits: 4, workload: 60 });
});

it('falls back to an older attempt for subjects outside the lists', () => {
  const loads = subjectLoads([
    course({ id: 'ELE07-00555', status: 'FAILED_BY_GRADE', workload: 90 }),
  ]);
  expect(loads.get('555')).toEqual({ credits: 6, workload: 90 });
});

it('skips invalid codes and empty numbers', () => {
  const loads = subjectLoads(
    [course({ id: 'sem código' })],
    [listed({ credits: null, workload: null })],
    [universal({ id: 'FIL01-00900', credits: null, workload: 30 })],
  );
  expect(loads.has('778')).toBe(false);
  expect(loads.get('900')).toEqual({ credits: null, workload: 30 });
  expect(loads.size).toBe(1);
});

it('takes each number from the first source that has it', () => {
  const loads = subjectLoads(
    [course({ status: 'IN_PROGRESS', credits: null, workload: 90 })],
    [listed({ id: 'IME01-00100', credits: 6, workload: 60 })],
  );
  // a carga do período em curso; o crédito, do currículo
  expect(loads.get('100')).toEqual({ credits: 6, workload: 90 });
});

it('keeps zero credits but looks further for a zero workload', () => {
  const loads = subjectLoads(
    [course({ status: 'IN_PROGRESS', credits: 0, workload: 0 })],
    [listed({ id: 'IME01-00100', credits: 4, workload: 30 })],
  );
  // atividade sem crédito: o 0 vale (fica fora do CR); carga 0 não serve
  expect(loads.get('100')).toEqual({ credits: 0, workload: 30 });
});
