import {
  Horario,
  Prereq,
  SubjectsTaken,
  SubjectInfo,
  CurriculumSubject,
} from '@root/modules/academics/domain/models';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import { completedSubjectIds } from '@root/modules/academics/domain/rules/completion';
import { TIME_DICTIONARY } from '@utils/constants/time';
import { Schedule, SubjectClasses } from './models';
import { AppError } from '@root/shared/errors/AppError';

export const MAX_CLASSES_AMOUNT = 30;
const days = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];
export function academicWeekdayToPlanningDay(day: number): number {
  return day - 1;
}

export function scheduleIntervals(schedules: readonly Horario[]): Schedule[] {
  return schedules.flatMap(schedule =>
    Object.entries(schedule).flatMap(([day, slots]) =>
      (slots ?? []).flatMap(group => {
        if (!group.length) return [];
        const first = TIME_DICTIONARY[group[0]];
        const last = TIME_DICTIONARY[group[group.length - 1]];
        const toMinutes = (time: string) => {
          const [hour, minute] = time.split(':').map(Number);
          return hour * 60 + minute;
        };
        const weekDay = days.indexOf(day);
        if (!first || !last || weekDay < 0)
          throw new AppError('INVALID_INPUT', 'Horário de turma inválido.');
        return [
          {
            week_day: weekDay,
            start_time_in_minutes: toMinutes(first[0]),
            end_time_in_minutes: toMinutes(last[1]),
          },
        ];
      }),
    ),
  );
}

export function hasScheduleConflict(
  target: readonly Schedule[],
  current: readonly Schedule[],
): boolean {
  return current.some(left =>
    target.some(
      right =>
        left.week_day === right.week_day &&
        left.start_time_in_minutes < right.end_time_in_minutes &&
        right.start_time_in_minutes < left.end_time_in_minutes,
    ),
  );
}

function completedSubjects(history: readonly SubjectsTaken[]) {
  return [
    ...new Map(
      history
        .filter(
          subject =>
            subject.status === 'APPROVED' || subject.status === 'EXEMPT',
        )
        .map(subject => [normalizeSubjectId(subject.id), subject]),
    ).values(),
  ];
}

/** Each row is an OR group; all non-credit rows must be satisfied (AND). */
export function prerequisitesSatisfied(
  groups: readonly Prereq[][],
  history: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[] = [],
): boolean {
  const completed = completedSubjectIds(history, curriculum);
  return groups
    .filter(
      group => group.length && !group[0].id.toUpperCase().includes('TRAVA'),
    )
    .every(group =>
      group.some(prerequisite =>
        completed.has(normalizeSubjectId(prerequisite.id)),
      ),
    );
}

export function subjectEligibility(
  curriculum: CurriculumSubject,
  details: SubjectInfo,
  history: readonly SubjectsTaken[],
  completedCurriculum: readonly CurriculumSubject[] = [],
) {
  const hasPrerequisites = prerequisitesSatisfied(
    details.prerequisite ?? [],
    history,
    completedCurriculum,
  );
  const credits = completedSubjects(history).reduce(
    (sum, subject) =>
      sum +
      (Number.isFinite(subject.credits)
        ? Math.max(0, subject.credits ?? 0)
        : 0),
    0,
  );
  const hasCredits = credits >= (curriculum.minimum_credits ?? 0);
  return {
    eligible: hasPrerequisites && hasCredits,
    reason: !hasPrerequisites
      ? 'Você não possui os pré-requisitos necessários.'
      : !hasCredits
        ? 'Você não possui créditos suficientes.'
        : null,
  };
}

export function availableClasses(
  subjects: readonly SubjectInfo[],
  busy: readonly Schedule[],
): SubjectClasses[] {
  return subjects.flatMap(subject =>
    (subject.classes ?? [])
      .filter(
        group =>
          !hasScheduleConflict(scheduleIntervals(group.schedule ?? []), busy),
      )
      .map(group => ({ ...group, subject_id: subject.id! })),
  );
}
