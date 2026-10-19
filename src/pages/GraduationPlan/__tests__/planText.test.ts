import type { PlanSubject } from '@root/modules/graduation/domain/plan';
import {
  blocksText,
  blocksTone,
  chainText,
  deadlineText,
  postponeText,
  reasonText,
  subjectMeta,
} from '../planText';

const subject = (fields: Partial<PlanSubject> = {}): PlanSubject => ({
  key: '401',
  id: 'FEN04-10401',
  name: 'Circuitos IV',
  credits: 4,
  workload: 60,
  kind: 'MANDATORY',
  recommendedPeriod: 5,
  minimumCredits: 0,
  prerequisites: [],
  placeholder: false,
  ...fields,
});

it('describes a subject and what it locks', () => {
  expect(subjectMeta(subject())).toBe('FEN04-10401 · 4 créditos · 60 h');
  expect(subjectMeta(subject({ placeholder: true, id: '', credits: 1 }))).toBe(
    'a escolher · 1 crédito',
  );
  expect(blocksText(7)).toBe('Trava 7 disciplinas');
  expect(blocksText(1)).toBe('Trava 1 disciplina');
  expect(blocksText(0)).toBe('Não trava outras disciplinas');
  expect(blocksTone(5)).toBe('bad');
  expect(blocksTone(3)).toBe('warn');
});

it('compares the plan with the deadline and the longest chain', () => {
  expect(deadlineText(2)).toBe('Cabe no prazo, com 2 períodos de folga');
  expect(deadlineText(0)).toBe('No limite do prazo: não sobra nenhum período');
  expect(deadlineText(-1)).toBe('Passa do prazo máximo em 1 período');
  expect(chainText(4, ['A', 'B', 'C', 'D'], 'normal')).toBe(
    'O plano já está no mínimo possível: 4 períodos, pela cadeia A → B → C → D.',
  );
  expect(chainText(6, ['A', 'B', 'C', 'D'], 'light')).toBe(
    'No ritmo Leve são 6 períodos. O mínimo possível é 4, pela cadeia A → B → C → D.',
  );
  expect(chainText(5, ['A', 'B', 'C'], 'normal', 1)).toBe(
    'Com o adiamento são 5 períodos. O mínimo possível é 3, pela cadeia A → B → C.',
  );
  expect(chainText(5, ['A', 'B', 'C'], 'normal', 2)).toMatch(
    /^Com os adiamentos são 5 períodos/,
  );
  expect(chainText(2, ['A'], 'normal')).toBeNull();
});

it('explains why a subject is in its period', () => {
  const base = {
    subject: subject({ minimumCredits: 180 }),
    postponed: false,
    waitedForCredits: false,
    lastPrerequisite: null,
    bottleneck: false,
  };
  expect(reasonText({ ...base, postponed: true })).toMatch(/adiou/);
  expect(reasonText({ ...base, waitedForCredits: true })).toBe(
    'Entra quando você chega a 180 créditos obrigatórios aprovados.',
  );
  expect(
    reasonText({
      ...base,
      lastPrerequisite: { name: 'Circuitos III', period: '2026.2' },
    }),
  ).toBe('Entra depois de Circuitos III, planejada para 2026.2.');
  expect(reasonText({ ...base, bottleneck: true })).toMatch(/trava outras/);
});

it('says what postponing does to the graduation', () => {
  expect(postponeText('2027.1', 1, '2028.2')).toEqual({
    tone: 'warn',
    text: 'Adiar para 2027.1 leva a formatura para 2028.2 (+1 período).',
  });
  expect(postponeText('2027.2', 0, '2028.1')).toEqual({
    tone: 'good',
    text: 'Adiar para 2027.2 não muda a formatura (2028.1).',
  });
});
