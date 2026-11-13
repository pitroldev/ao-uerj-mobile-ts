import { AppError } from '@root/shared/errors/AppError';
import { ScheduleCreationParams } from '../domain/models';
import {
  MAX_CLASSES_AMOUNT,
  TooManyClasses,
  classBlock,
  subjectEligibility,
  subjectShortfall,
} from '../domain/rules';
import { GenerationOptions, ScheduleGeneratorPort } from './ports';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

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
        form.curriculumSubjects,
      );
      if (!eligibility.eligible)
        throw new AppError(
          'INVALID_INPUT',
          `${details.name}: ${eligibility.reason}`,
        );
      const criticality = form.criticality?.[details.id];
      return isCount(criticality)
        ? { curriculum, details, criticality }
        : { curriculum, details };
    });
    const subjectIds = new Set(subjects.map(subject => subject.details.id));
    if (form.selectedClasses.some(group => !subjectIds.has(group.subject_id)))
      throw new AppError(
        'INVALID_INPUT',
        'Há turmas que não pertencem às disciplinas selecionadas.',
      );
    const lunch = form.lunch ?? null;
    // The routine is enforced here too (the server also filters it): a class
    // the student reselected by hand never reaches the request. Short of the
    // minimum, the error says why (routine, choices or selection).
    const shortfall = subjectShortfall({
      minimum: minimumSubjects,
      subjects: form.subjects,
      selectedClasses: form.selectedClasses,
      busy: form.busy_schedules,
      lunch,
    });
    if (shortfall) throw shortfall;
    const compatibleClasses = form.selectedClasses.filter(
      group => !classBlock(group, form.busy_schedules, lunch),
    );
    if (compatibleClasses.length > MAX_CLASSES_AMOUNT)
      throw new TooManyClasses(compatibleClasses.length);
    return this.generator.generate(
      {
        preferences: {
          minimumSubjects,
          maximumSubjects,
          priorities: form.priority,
          busyIntervals: form.busy_schedules,
          ...(lunch ? { lunch } : {}),
        },
        subjects,
        classes: compatibleClasses,
      },
      options,
    );
  }
}
