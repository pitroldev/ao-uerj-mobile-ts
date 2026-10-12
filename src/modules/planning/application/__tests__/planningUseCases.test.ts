import { GenerateSchedules } from '../GenerateSchedules';
import { LoadPlanningSubjects } from '../LoadPlanningSubjects';
import { form, curriculum, details } from '../testFixtures';
import { SubjectClasses } from '../../domain/models';

describe('GenerateSchedules', () => {
  it('passes domain inputs and abort signal to the generator', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const signal = new AbortController().signal;
    await expect(
      new GenerateSchedules(generator).execute(form, { signal }),
    ).resolves.toEqual([]);
    expect(generator.generate).toHaveBeenCalledWith(
      {
        preferences: {
          minimumSubjects: 1,
          maximumSubjects: 3,
          priorities: ['MAX_CREDITS'],
          busyIntervals: [],
        },
        subjects: [{ curriculum, details }],
        classes: form.selectedClasses,
      },
      { signal },
    );
  });
  it.each([
    { min_subject_amount: 5, max_subject_amount: 3 },
    { min_subject_amount: 0 },
    { selectedClasses: [] },
    {
      selectedClasses: [{ ...form.selectedClasses[0], subject_id: 'unknown' }],
    },
  ])('rejects invalid choices before posting %s', async changes => {
    const generator = { generate: jest.fn() };
    await expect(
      new GenerateSchedules(generator).execute({ ...form, ...changes }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('removes classes inside busy hours before calling a provider that ignores busy intervals', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const blocked = form.selectedClasses[0];
    const free: SubjectClasses = {
      ...blocked,
      classNumber: 2,
      schedule: [{ Terça: [['M1', 'M2']] }],
    };
    await new GenerateSchedules(generator).execute({
      ...form,
      selectedClasses: [blocked, free],
      busy_schedules: [
        { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 520 },
      ],
    });
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ classes: [free] }),
      undefined,
    );
  });

  it('returns no schedules without posting when busy hours leave fewer subjects than the requested minimum', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    await expect(
      new GenerateSchedules(generator).execute({
        ...form,
        busy_schedules: [
          { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 520 },
        ],
      }),
    ).resolves.toEqual([]);
    expect(generator.generate).not.toHaveBeenCalled();
  });
});

describe('LoadPlanningSubjects', () => {
  it('bounds concurrent requests, preserves input order and reports individual failures', async () => {
    const selected = [1, 2, 3, 4].map(code => ({
      ...curriculum,
      id: `IME01-0000${code}`,
    }));
    const pending = new Map<
      string,
      {
        resolve: (value: typeof details) => void;
        reject: (error: Error) => void;
      }
    >();
    const records = {
      getSubjectDetails: jest.fn(
        (subjectId: string) =>
          new Promise<typeof details>((resolve, reject) => {
            pending.set(subjectId, { resolve, reject });
          }),
      ),
    };
    const progress = jest.fn();
    const result = new LoadPlanningSubjects(records, 2).execute(
      selected,
      [],
      new AbortController().signal,
      progress,
    );
    expect(records.getSubjectDetails).toHaveBeenCalledTimes(2);
    pending.get(selected[1].id)!.resolve({ ...details, id: selected[1].id });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(records.getSubjectDetails).toHaveBeenCalledTimes(3);
    pending.get(selected[0].id)!.reject(new Error('network'));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(records.getSubjectDetails).toHaveBeenCalledTimes(4);
    pending.get(selected[2].id)!.resolve({ ...details, id: selected[2].id });
    pending.get(selected[3].id)!.resolve({ ...details, id: selected[3].id });
    const actual = await result;
    expect(actual.map(value => value.subject.id)).toEqual(
      selected.map(subject => subject.id),
    );
    expect(actual[0].error?.message).toBe('network');
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: 4, total: 4 }),
    );
  });
  it('does not start queued requests or publish late results after cancellation', async () => {
    let resolveLate!: (value: typeof details) => void;
    const records = {
      getSubjectDetails: jest.fn(
        () =>
          new Promise<typeof details>(resolve => {
            resolveLate = resolve;
          }),
      ),
    };
    const progress = jest.fn();
    const controller = new AbortController();
    const result = new LoadPlanningSubjects(records, 1).execute(
      [curriculum, { ...curriculum, id: 'IME01-11111' }],
      [],
      controller.signal,
      progress,
    );
    controller.abort();
    resolveLate(details);
    await expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(records.getSubjectDetails).toHaveBeenCalledTimes(1);
    expect(progress).not.toHaveBeenCalled();
  });
});
