import {
  CurriculumSubject,
  SubjectInfo,
} from '@root/modules/academics/domain/models';
import { ScheduleCreationParams, GeneratedSchedule } from '../domain/models';

export const curriculum: CurriculumSubject = {
  id: 'IME01-12345',
  name: 'Álgebra',
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: 0,
};
export const details: SubjectInfo = {
  id: curriculum.id,
  name: curriculum.name,
  credits: 4,
  workload: 60,
  prerequisite: [],
  classes: [
    {
      classNumber: 1,
      schedule: [{ Segunda: [['M1', 'M2']] }],
      teachers: ['Docente'],
      vacancies: { uerj: { available: 10 }, freshman: {} },
    },
  ],
};
export const form: ScheduleCreationParams = {
  min_subject_amount: 1,
  max_subject_amount: 3,
  priority: ['MAX_CREDITS'],
  busy_schedules: [],
  subjectsToTake: [curriculum],
  selectedSubjects: [curriculum],
  takenSubjects: [],
  subjects: [details],
  selectedClasses: [{ ...details.classes![0], subject_id: curriculum.id }],
};
export const generated: GeneratedSchedule = {
  hash: 'test-hash',
  total_credits: 4,
  total_week_days: 1,
  total_gaps_in_minutes: 0,
  total_workload: 60,
  schedule: [
    {
      id: '1',
      name: curriculum.name,
      type: 'REGULAR',
      teachers: ['Docente'],
      vacancies_amount: 10,
      subject_id: curriculum.id,
      schedules: [
        { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 520 },
      ],
      subject: {
        id: curriculum.id,
        name: curriculum.name,
        type: 'MANDATORY',
        credits: 4,
        total_workload: 60,
        prerequisites: [],
        allow_conflict: false,
      },
    },
  ],
};
