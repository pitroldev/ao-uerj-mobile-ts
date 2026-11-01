import { createScheduleGeneratorAdapter } from '../index';
import { legacyPrerequisiteIds } from '../mappers';
import { parseGeneratorResponse } from '../response';
import { GenerateSchedules } from '@root/modules/planning/application/GenerateSchedules';
import {
  form,
  generated,
} from '@root/modules/planning/application/testFixtures';
import { ScheduleCreationParams } from '@root/modules/planning/domain/models';

const formWithSubjects = (
  count: number,
  minimum = 1,
): ScheduleCreationParams => {
  const ids = Array.from(
    { length: count },
    (_, index) => `IME01-${12345 + index}`,
  );
  return {
    ...form,
    min_subject_amount: minimum,
    max_subject_amount: count,
    selectedSubjects: ids.map(id => ({ ...form.selectedSubjects[0], id })),
    subjects: ids.map(id => ({ ...form.subjects[0], id })),
    selectedClasses: ids.map(subject_id => ({
      ...form.selectedClasses[0],
      subject_id,
    })),
  };
};

it('sends the expected legacy DTO only at the adapter boundary', async () => {
  const transport = {
    post: jest.fn().mockResolvedValue({ data: { data: [generated] } }),
  };
  const signal = new AbortController().signal;
  const actual = await new GenerateSchedules(
    createScheduleGeneratorAdapter(transport),
  ).execute(form, { signal });
  expect(actual).toEqual([generated]);
  expect(transport.post).toHaveBeenCalledTimes(1);
  expect(transport.post).toHaveBeenCalledWith(
    '/generate',
    expect.objectContaining({
      preferences: {
        min_subject_amount: 1,
        max_subject_amount: 1,
        priority: ['MAX_CREDITS'],
        busy_schedules: [],
      },
      classes: [
        expect.objectContaining({
          subject_id: 'IME01-12345',
          schedules: [expect.objectContaining({ week_day: 0 })],
        }),
      ],
      subjects: [
        expect.objectContaining({ prerequisites: [], allow_conflict: false }),
      ],
    }),
    { signal },
  );
});

it('sends the criticality CRITICAL_FIRST ranks by, and nothing without it', async () => {
  const transport = {
    post: jest.fn().mockResolvedValue({ data: { data: [] } }),
  };
  const generate = (changes: Partial<ScheduleCreationParams>) =>
    new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute({
      ...form,
      ...changes,
    });
  const sentSubject = (call: number) =>
    JSON.parse(JSON.stringify(transport.post.mock.calls[call][1])).subjects[0];

  await generate({
    priority: ['CRITICAL_FIRST'],
    criticality: { [form.subjects[0].id!]: 4 },
  });
  expect(sentSubject(0)).toMatchObject({ criticality: 4 });

  await generate({});
  expect(sentSubject(1)).not.toHaveProperty('criticality');
});

it('characterizes legacy prerequisite flattening without changing the domain groups', () => {
  const groups = [
    [
      { id: 'A', name: 'A' },
      { id: 'B', name: 'B' },
    ],
    [
      { id: 'C', name: 'C' },
      { id: 'A', name: 'A' },
    ],
  ];
  expect(legacyPrerequisiteIds(groups)).toEqual(['A', 'B', 'C']);
  expect(groups).toHaveLength(2);
});

it.each([
  null,
  {},
  { data: '<html>error</html>' },
  { data: [{ ...generated, total_credits: NaN }] },
  {
    data: [
      {
        ...generated,
        schedule: [{ ...generated.schedule[0], teachers: null }],
      },
    ],
  },
])('rejects invalid server shape instead of casting %s', response => {
  expect(() => parseGeneratorResponse(response)).toThrow(
    'O gerador retornou uma resposta inválida.',
  );
});

it('accepts a class with more students than seats (negative vacancies)', () => {
  const overbooked = {
    ...generated,
    schedule: [{ ...generated.schedule[0], vacancies_amount: -3 }],
  };
  expect(parseGeneratorResponse({ data: [overbooked] })).toEqual([overbooked]);
  expect(() =>
    parseGeneratorResponse({
      data: [
        {
          ...generated,
          schedule: [{ ...generated.schedule[0], vacancies_amount: 'x' }],
        },
      ],
    }),
  ).toThrow('O gerador retornou uma resposta inválida.');
});

it('recognizes an empty valid result', () => {
  expect(parseGeneratorResponse({ data: [] })).toEqual([]);
});

it.each([1, 2, 3])(
  'an empty answer is final: one POST with the minimum %s',
  async minimum => {
    const transport = {
      post: jest.fn().mockResolvedValue({ data: { data: [] } }),
    };
    const draft = formWithSubjects(5, minimum);
    await expect(
      new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute(
        draft,
      ),
    ).resolves.toEqual([]);
    expect(
      transport.post.mock.calls.map(([, body]) => [
        body.preferences.min_subject_amount,
        body.preferences.max_subject_amount,
      ]),
    ).toEqual([[minimum, 5]]);
    expect(draft.max_subject_amount).toBe(5);
  },
);

it('sends the maximum clamped to the subjects that have classes', async () => {
  const transport = {
    post: jest.fn().mockResolvedValue({ data: { data: [generated] } }),
  };
  await new GenerateSchedules(
    createScheduleGeneratorAdapter(transport),
  ).execute({ ...formWithSubjects(3), max_subject_amount: 12 });
  expect(transport.post.mock.calls[0][1].preferences.max_subject_amount).toBe(
    3,
  );
});

it('reports a cancellation that arrives with the answer', async () => {
  const controller = new AbortController();
  const transport = {
    post: jest.fn().mockImplementation(async () => {
      controller.abort();
      return { data: { data: [generated] } };
    }),
  };
  await expect(
    new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute(
      formWithSubjects(5),
      { signal: controller.signal },
    ),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(transport.post).toHaveBeenCalledTimes(1);
});

it('propagates typed network errors without retrying the POST', async () => {
  const transport = {
    post: jest.fn().mockRejectedValue(new Error('unavailable')),
  };
  await expect(
    new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute(
      formWithSubjects(3),
    ),
  ).rejects.toMatchObject({ code: 'NETWORK' });
  expect(transport.post).toHaveBeenCalledTimes(1);
});
