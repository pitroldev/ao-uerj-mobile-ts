import {Turno, WeekDay} from '../../types/dateStuff';

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
  vacancies?: ClassVacancies;
}
