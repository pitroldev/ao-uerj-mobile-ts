import type { EnrollmentResultEntry } from '@root/modules/academics/domain/models';
import { enrollmentChanges, knowEnrollment } from '../changes';
import { enrollmentMessage } from '../messages';

/** Mudanças em relação a um resultado anterior lido inteiro. */
const changesFrom = (
  previous: EnrollmentResultEntry[],
  current: EnrollmentResultEntry[],
) => enrollmentChanges(knowEnrollment({}, previous), current);

const entry = (
  overrides: Partial<EnrollmentResultEntry> = {},
): EnrollmentResultEntry => ({
  id: 'IME02-00001',
  name: 'Cálculo II',
  classNumber: '3',
  accepted: true,
  reason: '',
  ...overrides,
});

describe('enrollmentChanges', () => {
  it('reports new subjects and a new acceptance or reason', () => {
    const previous = [
      entry(),
      entry({ id: 'IME02-00002', accepted: false, reason: 'Sem vaga' }),
      entry({ id: 'IME02-00003', accepted: false, reason: 'Sem vaga' }),
    ];
    const current = [
      entry(),
      entry({ id: 'IME02-00002', name: 'Física I' }),
      entry({
        id: 'IME02-00003',
        accepted: false,
        reason: 'Choque de horário',
      }),
      entry({ id: 'IME02-00004', name: 'Química', classNumber: '1' }),
    ];
    expect(
      changesFrom(previous, current).map(change => [
        change.subjectId,
        change.previous,
      ]),
    ).toEqual([
      ['IME02-00002', { accepted: false, reason: 'Sem vaga' }],
      ['IME02-00003', { accepted: false, reason: 'Sem vaga' }],
      ['IME02-00004', null],
    ]);
  });

  it('ignores the same result read again', () => {
    expect(changesFrom([entry()], [entry()])).toEqual([]);
  });

  it('keeps the known result through an empty reading', () => {
    const known = knowEnrollment(knowEnrollment({}, [entry()]), []);
    expect(enrollmentChanges(known, [entry()])).toEqual([]);
  });
});

describe('enrollmentMessage', () => {
  it.each([
    [[entry()], 'Cálculo II (turma 3): inscrição aceita.'],
    [
      [entry({ accepted: false, reason: 'Falta Requisito (CO/PRE)' })],
      'Cálculo II (turma 3): inscrição não aceita, falta requisito (CO/PRE).',
    ],
    [
      [
        entry(),
        entry({ id: 'IME02-00002', name: 'Física I' }),
        entry({
          id: 'IME02-00003',
          name: 'Química',
          accepted: false,
          reason: 'Falta Requisito (CO/PRE)',
        }),
      ],
      'Aceitas: Cálculo II e Física I. Não aceitas: Química — falta requisito (CO/PRE).',
    ],
    [
      [
        entry({ accepted: false, reason: 'Sem vaga' }),
        entry({ id: 'IME02-00002', name: 'Física I', accepted: false }),
      ],
      'Não aceitas: Cálculo II — sem vaga; Física I.',
    ],
    [
      [
        entry({ accepted: false }),
        entry({ id: 'IME02-00002', name: 'Física I', accepted: false }),
      ],
      'Não aceitas: Cálculo II e Física I.',
    ],
  ])('sums up the first result %j', (result, body) => {
    expect(enrollmentMessage(result, changesFrom([], result))).toEqual({
      id: 'enrollment:result',
      channel: 'enrollment',
      title: 'Resultado da inscrição',
      body,
      publicTitle: 'Resultado da inscrição',
      publicBody: 'Desbloqueie o aparelho para ver o resultado.',
      target: 'home',
    });
  });

  it('repeats the whole result when only part of it changed', () => {
    const previous = [
      entry(),
      entry({ id: 'IME02-00002', name: 'Física I', accepted: false }),
    ];
    const current = [entry(), entry({ id: 'IME02-00002', name: 'Física I' })];
    expect(
      enrollmentMessage(current, changesFrom(previous, current)),
    ).toMatchObject({
      title: 'Resultado da inscrição atualizado',
      body: 'Aceitas: Cálculo II e Física I.',
    });
  });

  it('says the result changed even when every subject changed', () => {
    const current = [
      entry({ accepted: false, reason: 'Falta Requisito (CO/PRE)' }),
    ];
    expect(
      enrollmentMessage(current, changesFrom([entry()], current)).title,
    ).toBe('Resultado da inscrição atualizado');
  });

  it('presents the result of another enrollment as a new result', () => {
    const current = [entry({ id: 'IME02-00009', name: 'Química' })];
    expect(
      enrollmentMessage(current, changesFrom([entry()], current)).title,
    ).toBe('Resultado da inscrição');
  });
});
