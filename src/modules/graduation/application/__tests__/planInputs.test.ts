import type {
  CurriculumSubject,
  GraduationSynthesis,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import {
  planInputs,
  planSubject,
  postponementAt,
  postponementIndexes,
  type PlanSources,
} from '../planInputs';

const listed = (
  id: string,
  fields: Partial<CurriculumSubject> = {},
): CurriculumSubject => ({
  id,
  name: `Disciplina ${id}`,
  period: 6,
  alreadyTaken: false,
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
  ...fields,
});
const taken = (
  id: string,
  fields: Partial<SubjectsTaken> = {},
): SubjectsTaken => ({
  id,
  name: `Disciplina ${id}`,
  period: '2025.2',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});

const CURRICULUM = [
  listed('FEN04-00001', { alreadyTaken: true }),
  listed('FEN04-00002'),
  listed('FEN04-00003'),
  listed('FEN04-00004', { minimum_credits: 100 }),
  listed('FEN04-00005', { type: 'RESTRICTED', credits: 3 }),
  listed('FEN04-00006', { type: 'RESTRICTED', credits: 3 }),
];
const synthesis = (
  requirements: GraduationSynthesis['requirements'],
): GraduationSynthesis => ({
  curriculumVersion: '1 - Exemplo',
  regime: 'Crédito',
  cr: 7,
  requirements,
  periods: { minimum: 10, used: 8, maximum: 14, remaining: 6, extra: 0 },
  currentPeriod: '2026.1',
});

const sources = (fields: Partial<PlanSources> = {}): PlanSources => ({
  curriculum: CURRICULUM,
  history: [taken('FEN04-00007')],
  inProgress: ['FEN04-00003'],
  synthesis: null,
  electiveCredits: defaultElectiveCredits,
  ...fields,
});

describe('plan inputs', () => {
  it('plans the mandatory subjects still missing, counting the current ones as passed', () => {
    const inputs = planInputs(sources());
    expect(inputs.remaining.map(item => item.id)).toEqual([
      'FEN04-00002',
      'FEN04-00004',
    ]);
    expect([...inputs.completed].sort()).toEqual(['1', '3', '7']);
    // aprovada no histórico (4) + a em curso (4)
    expect(inputs.mandatoryCredits).toBe(8);
    expect(inputs.electives).toEqual([]);
  });

  it('takes the mandatory credits and the missing electives from the Síntese', () => {
    const inputs = planInputs(
      sources({
        synthesis: synthesis([
          {
            kind: 'MANDATORY',
            label: 'Grupo de Obrigatórias',
            branch: 'A',
            done: 90,
            required: 120,
          },
          {
            kind: 'MANDATORY',
            label: 'Grupo de Obrigatórias',
            branch: 'B',
            done: 30,
            required: 40,
          },
          {
            kind: 'RESTRICTED',
            label: 'Restritas',
            branch: null,
            done: 3,
            required: 10,
          },
          {
            kind: 'ELECTIVES',
            label: 'Total de Eletivas',
            branch: null,
            done: 3,
            required: 14,
          },
        ]),
      }),
    );
    expect(inputs.mandatoryCredits).toBe(124);
    // 7 créditos de restritas em vagas de 3 (o tamanho comum do grupo) e 4
    // créditos a mais pelo total de eletivas
    expect(inputs.electives.map(slot => [slot.kind, slot.credits])).toEqual([
      ['RESTRICTED', 3],
      ['RESTRICTED', 3],
      ['RESTRICTED', 1],
      ['ELECTIVE', 3],
      ['ELECTIVE', 1],
    ]);
  });

  it('uses the electives configured in Meu Progresso without the Síntese', () => {
    const inputs = planInputs(
      sources({ electiveCredits: { RESTRICTED: 6, DEFINED: 0, UNIVERSAL: 0 } }),
    );
    expect(inputs.electives.map(slot => slot.credits)).toEqual([3, 3]);
  });
});

describe('plan subjects', () => {
  it('joins the curriculum with the prerequisites read, keeping the highest lock', () => {
    const subject = planSubject(
      listed('FEN04-00004', { minimum_credits: 100 }),
      {
        '4': { groups: [['2']], creditLock: 120 },
      },
    );
    expect(subject).toMatchObject({
      key: '4',
      minimumCredits: 120,
      prerequisites: [['2']],
    });
    expect(planSubject(listed('FEN04-00002'), {}).prerequisites).toBeNull();
  });
});

describe('postponements', () => {
  it('keeps the period when it is known and turns it into a plan index', () => {
    expect(postponementAt(1, '2026.1')).toEqual({ period: '2027.1' });
    expect(postponementAt(1, null)).toEqual({ index: 1 });
    expect(
      postponementIndexes(
        {
          '1': { period: '2027.1' },
          '2': { index: 2 },
          // já passou: deixa de valer
          '3': { period: '2025.2' },
        },
        '2026.1',
      ),
    ).toEqual(
      new Map([
        ['1', 1],
        ['2', 2],
      ]),
    );
  });
});
