import { GenerateSchedules } from '../GenerateSchedules';
import { form, curriculum, details } from '../testFixtures';
import { SubjectClasses } from '../../domain/models';
import { lunchBreak } from '../../domain/lunch';
import { SubjectShortfall, TooManyClasses } from '../../domain/rules';

describe('GenerateSchedules', () => {
  it('retains the same curriculum completion evidence during final validation', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const prerequisite = {
      ...curriculum,
      id: 'IME01-11111',
      alreadyTaken: true,
    };
    await expect(
      new GenerateSchedules(generator).execute({
        ...form,
        subjects: [
          {
            ...details,
            prerequisite: [[{ id: prerequisite.id, name: 'Pré-requisito' }]],
          },
        ],
        curriculumSubjects: [prerequisite],
      }),
    ).resolves.toEqual([]);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
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
  it('sends how many pending subjects each one locks, when it is known', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    await new GenerateSchedules(generator).execute({
      ...form,
      priority: ['CRITICAL_FIRST'],
      criticality: { [details.id!]: 3, 'IME01-99999': 7 },
    });
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        subjects: [{ curriculum, details, criticality: 3 }],
      }),
      undefined,
    );
  });

  it.each([-1, 1.5, Number.NaN])(
    'drops a criticality that is not a count (%s)',
    async value => {
      const generator = { generate: jest.fn().mockResolvedValue([]) };
      await new GenerateSchedules(generator).execute({
        ...form,
        criticality: { [details.id!]: value },
      });
      expect(generator.generate.mock.calls[0][0].subjects).toStrictEqual([
        { curriculum, details },
      ]);
    },
  );

  it.each([
    { min_subject_amount: 5, max_subject_amount: 3 },
    { min_subject_amount: 0 },
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

  it('explains, without posting, that busy hours leave fewer subjects than the requested minimum', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const run = new GenerateSchedules(generator).execute({
      ...form,
      busy_schedules: [
        { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 520 },
      ],
    });
    await expect(run).rejects.toBeInstanceOf(SubjectShortfall);
    await expect(run).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      reason: 'ROUTINE',
    });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('explains when the selected classes cover fewer subjects than the minimum', async () => {
    const generator = { generate: jest.fn() };
    const other = { ...details, id: 'IME01-54321', name: 'Cálculo' };
    await expect(
      new GenerateSchedules(generator).execute({
        ...form,
        min_subject_amount: 2,
        selectedSubjects: [curriculum, { ...curriculum, id: other.id }],
        subjects: [details, other],
      }),
    ).rejects.toMatchObject({ reason: 'SELECTION', available: 1 });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('explains that the student took every class out', async () => {
    const generator = { generate: jest.fn() };
    await expect(
      new GenerateSchedules(generator).execute({
        ...form,
        selectedClasses: [],
      }),
    ).rejects.toMatchObject({ reason: 'SELECTION', available: 0 });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('refuses more classes than the generator combines, counting only the ones that fit', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const many = (count: number, day: 'Terça' | 'Segunda') =>
      Array.from({ length: count }, (_, index): SubjectClasses => ({
        ...form.selectedClasses[0],
        classNumber: index + 1,
        schedule: [{ [day]: [['N1', 'N2']] }],
      }));
    const busy = [
      { week_day: 0, start_time_in_minutes: 1080, end_time_in_minutes: 1130 },
    ];
    const run = new GenerateSchedules(generator).execute({
      ...form,
      selectedClasses: many(31, 'Terça'),
    });
    await expect(run).rejects.toBeInstanceOf(TooManyClasses);
    await expect(run).rejects.toMatchObject({ selected: 31, limit: 30 });
    expect(generator.generate).not.toHaveBeenCalled();

    // as que batem com um horário ocupado não contam para o limite
    await new GenerateSchedules(generator).execute({
      ...form,
      busy_schedules: busy,
      selectedClasses: [...many(30, 'Terça'), ...many(5, 'Segunda')],
    });
    expect(generator.generate.mock.calls[0][0].classes).toHaveLength(30);
  });

  it('sends the lunch break and drops the class that leaves none by itself', async () => {
    const generator = { generate: jest.fn().mockResolvedValue([]) };
    const lunch = lunchBreak(50)!;
    const overLunch: SubjectClasses = {
      ...form.selectedClasses[0],
      classNumber: 2,
      schedule: [{ Terça: [['M6', 'T1', 'T2', 'T3']] }],
    };
    await new GenerateSchedules(generator).execute({
      ...form,
      lunch,
      selectedClasses: [form.selectedClasses[0], overLunch],
    });
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ lunch }),
        classes: [form.selectedClasses[0]],
      }),
      undefined,
    );

    // sem o almoço, o pedido não leva o campo
    await new GenerateSchedules(generator).execute({ ...form, lunch: null });
    expect(generator.generate.mock.calls[1][0].preferences).not.toHaveProperty(
      'lunch',
    );
  });
});
