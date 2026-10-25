import type { ComplementaryActivity, GraduationSynthesis } from '../../models';
import { summarizeComplementary } from '../complementary';

const activity = (
  type: string,
  hours: number | null,
  period = '2024.2',
): ComplementaryActivity => ({ period, type, hours, description: '' });

const synthesis = (
  requirements: GraduationSynthesis['requirements'],
): GraduationSynthesis => ({
  curriculumVersion: null,
  regime: 'Crédito',
  cr: null,
  requirements,
  periods: {
    minimum: null,
    used: null,
    maximum: null,
    remaining: null,
    extra: null,
  },
  currentPeriod: null,
});

it('counts each type only up to its cap, as the portal summary says', () => {
  const summary = summarizeComplementary({
    activities: [
      activity('Extensão', 30),
      activity('Extensão', 40),
      activity('Palestras', 4),
    ],
    byType: [
      { type: 'Extensão', maximum: 60, counted: 60, excess: 10, total: 70 },
      { type: 'Palestras', maximum: 20, counted: 4, excess: 0, total: 4 },
    ],
  });
  expect(summary).toMatchObject({ counted: 64, excess: 10, required: null });
  expect(
    summary?.types.map(item => [item.type, item.activities.length]),
  ).toEqual([
    ['Extensão', 2],
    ['Palestras', 1],
  ]);
});

it('sums the activities without the summary, capped when the cap is known', () => {
  const summary = summarizeComplementary({
    activities: [activity('Monitoria', 12), activity('Monitoria', null)],
    byType: [],
  });
  expect(summary).toMatchObject({ counted: 12, excess: 0 });
  expect(summary?.types[0]).toMatchObject({ maximum: null, counted: 12 });
});

it('takes the required hours from a "complementar" requirement of the Síntese', () => {
  const summary = summarizeComplementary(
    { activities: [activity('Extensão', 30)], byType: [] },
    synthesis([
      {
        kind: 'OTHER',
        label: 'Atividades Complementares',
        branch: null,
        done: 30,
        required: 200,
      },
    ]),
  );
  expect(summary).toMatchObject({ counted: 30, required: 200, progress: 30 });
});

it('counts the official done hours of the Síntese, even the ones not itemized', () => {
  const summary = summarizeComplementary(
    { activities: [activity('Extensão', 180)], byType: [] },
    synthesis([
      {
        kind: 'OTHER',
        label: 'Atividades Complementares',
        branch: null,
        done: 200,
        required: 200,
      },
    ]),
  );
  expect(summary).toMatchObject({ counted: 180, required: 200, progress: 200 });
  // sem o cumprido na Síntese, vale a soma por tipo
  const itemized = summarizeComplementary(
    { activities: [activity('Extensão', 180)], byType: [] },
    synthesis([
      {
        kind: 'OTHER',
        label: 'Atividades Complementares',
        branch: null,
        done: null,
        required: 200,
      },
    ]),
  );
  expect(itemized?.progress).toBe(180);
});

it('has nothing to show without activities, summary nor requirement', () => {
  expect(summarizeComplementary({ activities: [], byType: [] })).toBeNull();
  expect(summarizeComplementary(undefined, synthesis([]))).toBeNull();
});
