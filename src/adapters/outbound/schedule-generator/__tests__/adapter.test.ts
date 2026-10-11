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

it('recognizes an empty valid result', () => {
  expect(parseGeneratorResponse({ data: [] })).toEqual([]);
});

it('recovers valid two-subject schedules omitted by the legacy minimum of three and stops at the first solution', async () => {
  const twoSubjects = {
    ...generated,
    schedule: [
      generated.schedule[0],
      {
        ...generated.schedule[0],
        subject_id: 'IME01-12346',
        subject: { ...generated.schedule[0].subject, id: 'IME01-12346' },
      },
    ],
    total_credits: 8,
    total_workload: 120,
  };
  const transport = {
    post: jest
      .fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [twoSubjects] } }),
  };
  const draft = formWithSubjects(5);
  await expect(
    new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute(
      draft,
    ),
  ).resolves.toEqual([twoSubjects]);
  expect(
    transport.post.mock.calls.map(
      ([, body]) => body.preferences.max_subject_amount,
    ),
  ).toEqual([5, 2]);
  expect(draft.max_subject_amount).toBe(5);
});

it.each([
  [1, [5, 2, 1]],
  [2, [5, 2]],
  [3, [5]],
] as const)(
  'limits empty-result probes to the requested minimum %s',
  async (minimum, maximums) => {
    const transport = {
      post: jest.fn().mockResolvedValue({ data: { data: [] } }),
    };
    await expect(
      new GenerateSchedules(createScheduleGeneratorAdapter(transport)).execute(
        formWithSubjects(5, minimum),
      ),
    ).resolves.toEqual([]);
    expect(
      transport.post.mock.calls.map(
        ([, body]) => body.preferences.max_subject_amount,
      ),
    ).toEqual(maximums);
  },
);

it('does not start another size probe after cancellation', async () => {
  const controller = new AbortController();
  const transport = {
    post: jest.fn().mockImplementation(async () => {
      controller.abort();
      return { data: { data: [] } };
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
