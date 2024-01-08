import {CurriculumSubject} from '@features/CurriculumSubjects/types';
import {SubjectsTaken} from '@features/SubjectsTaken/types';
import {SubjectInfo} from '@features/SubjectInfo/types';
import {SubjectClassesSchedule} from '@features/SubjectClassesSchedule/types';

export type Schedule = {
  week_day: number;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

export interface SubjectClasses extends SubjectClassesSchedule {
  subject_id: string;
}

export type Priority =
  | 'MAX_CREDITS'
  | 'MAX_DAY_WORKLOAD'
  | 'MIN_DAY_WORKLOAD'
  | 'MAX_WORKLOAD'
  | 'MIN_WORKLOAD'
  | 'LIVES_FAR_AWAY'
  | 'MIN_GAPS'
  | 'MANDATORY_CLASSES'
  | 'MOST_SUBJECTS_POSSIBLE'
  | 'CRITICAL_FIRST';

export type ScheduleCreationParams = {
  min_subject_amount: number | null;
  max_subject_amount: number | null;
  busy_schedules: Schedule[];
  priority: Priority[];
  subjectsToTake: CurriculumSubject[];
  selectedSubjects: CurriculumSubject[];
  takenSubjects: SubjectsTaken[];
  subjects: SubjectInfo[];
  selectedClasses: SubjectClasses[];
};

export type GeneratedSubject = {
  id: string;
  name: string;
  type: string;
  credits: number;
  total_workload: number;
  prerequisites: string[];
  allow_conflict: boolean;
  recomended_period?: number;
  minimum_credits?: number;
  criticality?: number;
  blocks?: number;
};

export interface GeneratedClassWithSubject {
  subject: GeneratedSubject;
  id: string;
  name: string;
  type: string;
  teachers: string[];
  vacancies_amount: number;
  subject_id: GeneratedSubject['id'];
  schedules: Schedule[];
}

export type GeneratedSchedule = {
  schedule: GeneratedClassWithSubject[];
  total_week_days: number;
  total_gaps_in_minutes: number;
  total_credits: number;
  total_workload: number;
  hash: string;
};

export type RenderedSchedule = {
  [weekDay: string]: {
    start_time_in_minutes: number;
    end_time_in_minutes: number;
    subject: GeneratedClassWithSubject;
    class_id: string;
  }[];
};
