import { Prereq } from '@root/modules/academics/domain/models';
import { ScheduleGenerationRequest } from '@root/modules/planning/application/ports';
import { scheduleIntervals } from '@root/modules/planning/domain/rules';

/** The deployed legacy request is flat. Keep OR groups in the domain, flatten only at this boundary. */
export function legacyPrerequisiteIds(
  groups: readonly Prereq[][] = [],
): string[] {
  return [
    ...new Set(
      groups.flatMap(group => group.map(prerequisite => prerequisite.id)),
    ),
  ];
}

export function toGeneratorPayload(request: ScheduleGenerationRequest) {
  const subjects = request.subjects.map(({ curriculum, details }) => ({
    id: details.id!,
    name: details.name!,
    type: curriculum.type,
    credits: details.credits ?? 0,
    prerequisites: legacyPrerequisiteIds(details.prerequisite),
    allow_conflict: details.conflito ?? false,
    recomended_period: curriculum.period ?? undefined,
    minimum_credits: curriculum.minimum_credits ?? undefined,
    total_workload: details.workload ?? 0,
  }));
  const classes = request.classes.map(group => {
    const subject = subjects.find(
      candidate => candidate.id === group.subject_id,
    )!;
    return {
      id: String(group.classNumber ?? ''),
      name: subject.name,
      type: group.hasPreference ? 'PREFERRED' : 'REGULAR',
      teachers: group.teachers ?? [],
      vacancies_amount: group.vacancies.uerj.available ?? 0,
      subject_id: subject.id,
      schedules: scheduleIntervals(group.schedule ?? []),
      selected_by_user: false,
    };
  });
  return {
    preferences: {
      min_subject_amount: request.preferences.minimumSubjects,
      max_subject_amount: request.preferences.maximumSubjects,
      priority: request.preferences.priorities,
      busy_schedules: request.preferences.busyIntervals,
    },
    classes,
    subjects,
  };
}
