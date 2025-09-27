import { Turno, WeekDay } from '@root/types/dateStuff';

export type Horario = {
  [weekDay in WeekDay]?: Turno[][];
};

export type VacanciesType = {
  available: number;
  taken: number;
  requestedAvailable: number;
  requestedTaken: number;
  preferential: number;
};

export type ClassVacancies = {
  uerj: Partial<VacanciesType>;
  freshman: Partial<VacanciesType>;
};

export interface SubjectClassesSchedule {
  location?: string;
  classNumber?: number;
  hasPreference?: boolean;
  schedule?: Horario[];
  teachers?: string[];
  vacancies: ClassVacancies;
}

export interface Prereq {
  name: string;
  id: string;
}

export interface SubjectInfo {
  id?: string;
  code?: number;
  name?: string;
  credits?: number;
  workload?: number;
  timesPerWeek?: number;
  universal?: boolean;
  conflito?: boolean;
  preparo?: boolean;
  approvation_type?: string;
  duration?: string;
  prerequisite?: Array<Prereq[]>;
  classes?: SubjectClassesSchedule[];
}
