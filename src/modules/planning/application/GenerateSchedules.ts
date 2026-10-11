import { AppError } from '@root/shared/errors/AppError';
import { ScheduleCreationParams } from '../domain/models';
import {
  MAX_CLASSES_AMOUNT,
  hasScheduleConflict,
  scheduleIntervals,
  subjectEligibility,
} from '../domain/rules';
import { GenerationOptions, ScheduleGeneratorPort } from './ports';

export class GenerateSchedules {
  constructor(private readonly generator: ScheduleGeneratorPort) {}
  async execute(form: ScheduleCreationParams, options?: GenerationOptions) {
    if (options?.signal?.aborted) throw new AppError('CANCELLED');
    const minimumSubjects = form.min_subject_amount;
    const maximumSubjects = form.max_subject_amount;
    if (
      !minimumSubjects ||
      !maximumSubjects ||
      !Number.isInteger(minimumSubjects) ||
      !Number.isInteger(maximumSubjects) ||
      minimumSubjects < 1 ||
      minimumSubjects > maximumSubjects ||
      maximumSubjects > 12
    )
      throw new AppError(
        'INVALID_INPUT',
        'Informe quantidades de disciplinas entre 1 e 12, com mínimo menor ou igual ao máximo.',
      );
    if (
      !form.selectedClasses.length ||
      form.selectedClasses.length > MAX_CLASSES_AMOUNT
    )
      throw new AppError('INVALID_INPUT', 'Selecione entre 1 e 30 turmas.');
    const subjects = form.subjects.map(details => {
      const curriculum = form.selectedSubjects.find(
        subject => subject.id === details.id,
      );
      if (!curriculum || !details.id || !details.name)
        throw new AppError(
          'INVALID_INPUT',
          'Carregue os dados das disciplinas selecionadas novamente.',
        );
      const eligibility = subjectEligibility(
        curriculum,
        details,
        form.takenSubjects,
      );
      if (!eligibility.eligible)
        throw new AppError(
          'INVALID_INPUT',
          `${details.name}: ${eligibility.reason}`,
        );
      return { curriculum, details };
    });
    const subjectIds = new Set(subjects.map(subject => subject.details.id));
    if (form.selectedClasses.some(group => !subjectIds.has(group.subject_id)))
      throw new AppError(
        'INVALID_INPUT',
        'Há turmas que não pertencem às disciplinas selecionadas.',
      );
    if (
      new Set(form.selectedClasses.map(group => group.subject_id)).size <
      minimumSubjects
    )
      throw new AppError(
        'INVALID_INPUT',
        'Selecione turmas de disciplinas suficientes para atingir o mínimo.',
      );
    // The deployed generator ignores busy_schedules; enforce the student's
    // unavailable hours before sending even manually reselected classes.
    const compatibleClasses = form.selectedClasses.filter(
      group =>
        !hasScheduleConflict(
          scheduleIntervals(group.schedule ?? []),
          form.busy_schedules,
        ),
    );
    if (
      new Set(compatibleClasses.map(group => group.subject_id)).size <
      minimumSubjects
    )
      return [];
    return this.generator.generate(
      {
        preferences: {
          minimumSubjects,
          maximumSubjects,
          priorities: form.priority,
          busyIntervals: form.busy_schedules,
        },
        subjects,
        classes: compatibleClasses,
      },
      options,
    );
  }
}
