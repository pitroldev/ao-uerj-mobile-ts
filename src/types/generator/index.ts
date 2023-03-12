export type ClassTypes = 'PREFERRED' | 'REGULAR';
export type SubjectTypes = 'MANDATORY' | 'DEFINED' | 'RESTRICTED' | 'UNIVERSAL';

export type Subject = {
  id: string;
  name: string;
  type: string;
  credits: number;
  total_workload: number;
  prerequisites: string[];
  allow_conflict: boolean;
  recomended_period?: number;
  minimum_credits?: number;
};

export type Schedule = {
  week_day: number;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

export type Class = {
  id: string;
  name: string;
  type: string;
  teachers: string[];
  vacancies_amount: number;
  subject_id: Subject['id'];
  schedules: Schedule[];
  selected_by_user?: boolean;
};
