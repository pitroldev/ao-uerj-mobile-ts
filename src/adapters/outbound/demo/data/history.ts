/*
 * Histórico e currículo. Os períodos são contados a partir do corrente
 * (`back` períodos antes dele), para a conta nunca envelhecer: o aluno entrou
 * há sete períodos e está no oitavo.
 */
import type {
  CurriculumSubject,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import type { DemoClock } from '../clock';
import { CURRICULUM_SEED, catalogEntry, subjectDetails } from './catalog';
import { ENROLLED } from './enrolled';
import { PAST_PERIODS } from './student';

type HistorySeed = [
  back: number,
  id: string,
  status: Exclude<SubjectsTaken['status'], 'IN_PROGRESS'>,
  grade: number | null,
  frequency: number | null,
];

const HISTORY_SEED: HistorySeed[] = [
  [7, 'IME01-10012', 'APPROVED', 7, 92],
  [7, 'IME01-10015', 'APPROVED', 8.4, 96],
  [7, 'IME02-10801', 'APPROVED', 7.8, 90],
  [7, 'IME02-10802', 'APPROVED', 9.1, 100],
  [7, 'IME02-10803', 'APPROVED', 9.6, 100],

  // as reprovações: Cálculo II por nota e Física I por falta, refeitas depois
  [6, 'IME01-10022', 'FAILED_BY_GRADE', 3.8, 88],
  [6, 'IME01-10031', 'APPROVED', 6.9, 86],
  [6, 'FIS01-10120', 'FAILED_BY_ATTENDANCE', 2, 58],
  [6, 'IME02-10811', 'APPROVED', 8.8, 94],
  [6, 'IME02-10812', 'APPROVED', 8.2, 92],

  [5, 'IME01-10022', 'APPROVED', 6.4, 90],
  [5, 'FIS01-10120', 'APPROVED', 7.1, 84],
  [5, 'IME03-10210', 'APPROVED', 7.6, 88],
  [5, 'IME02-10821', 'APPROVED', 8.7, 96],
  [5, 'IME02-10823', 'APPROVED', 9, 100],

  [4, 'IME01-10041', 'APPROVED', 6.2, 82],
  [4, 'IME02-10822', 'APPROVED', 7.9, 90],
  [4, 'IME02-10841', 'APPROVED', 8.5, 94],
  [4, 'IME02-10842', 'APPROVED', 9.3, 98],
  [4, 'ILE01-10301', 'APPROVED', 9.5, 100],

  [3, 'IME04-10901', 'APPROVED', 7.3, 88],
  [3, 'IME02-10843', 'APPROVED', 8.1, 92],
  [3, 'IME02-10844', 'APPROVED', 7.7, 90],
  [3, 'IME02-10838', 'APPROVED', 9.4, 100],
  [3, 'IME03-10260', 'CANCELED', null, null],

  [2, 'IME02-10860', 'APPROVED', 8, 92],
  [2, 'IME02-10862', 'APPROVED', 8.6, 96],
  [2, 'IME02-10863', 'APPROVED', 8.9, 94],
  [2, 'IME02-10864', 'APPROVED', 7.2, 86],
  [2, 'ILE02-10115', 'APPROVED', 9.8, 100],

  [1, 'IME02-10872', 'APPROVED', 8.8, 96],
  [1, 'IME02-10873', 'APPROVED', 7.5, 90],
  [1, 'IME02-10874', 'APPROVED', 9.2, 100],
  [1, 'IME02-11031', 'APPROVED', 8.3, 92],
  [1, 'ICS01-10230', 'APPROVED', 9, 96],
];

/** O tipo como o parser do histórico o escreve (`parseSubjectType`). */
function taken(
  period: string,
  id: string,
  status: SubjectsTaken['status'],
  grade: number | null,
  frequency: number | null,
): SubjectsTaken {
  const { name, type, credits, workload } = catalogEntry(id);
  return {
    id,
    name,
    period,
    credits,
    workload,
    type,
    frequency,
    grade,
    status,
  };
}

/** O histórico, com as disciplinas em curso ("Em Preparo") no fim. */
export function history(clock: DemoClock): SubjectsTaken[] {
  const past = HISTORY_SEED.map(([back, id, status, grade, frequency]) =>
    taken(clock.period(back), id, status, grade, frequency),
  );
  const current = ENROLLED.map(subject =>
    taken(clock.period(), subject.id, 'IN_PROGRESS', null, null),
  );
  return [...past, ...current];
}

/** Aprovadas (ou isentas) em algum período anterior. */
export const APPROVED_IDS: ReadonlySet<string> = new Set(
  HISTORY_SEED.filter(([, , status]) => status === 'APPROVED').map(
    ([, id]) => id,
  ),
);

/** Períodos já usados, com o corrente: o que a Síntese chama de utilizados. */
export const USED_PERIODS = PAST_PERIODS + 1;

export function curriculum(): CurriculumSubject[] {
  return CURRICULUM_SEED.map(
    ([id, name, period, type, credits, workload, extra]) => ({
      id,
      name,
      period,
      alreadyTaken: APPROVED_IDS.has(id),
      type,
      branch: extra?.branch ?? '',
      credits,
      workload,
      minimum_credits: extra?.minimumCredits ?? null,
      // "Período atual" no portal: há turma neste período
      subjectOfPeriod: Boolean(subjectDetails(id)?.classes?.length),
    }),
  );
}
