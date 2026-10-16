export type WeekDay =
  'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';

type Turno =
  | 'M1'
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'N1'
  | 'N2'
  | 'N3'
  | 'N4'
  | 'N5'
  | 'N6';

export type RawSubjectInfo = {
  index: string;
  codeAndName: string;
  class: string;
  avaLocation: string;
  uerjLocationOrStatus: string;
};

export type AttendedSubjectInfo = {
  id: string;
  name: string;
  class: string;
  avaLocation: string;
  uerjLocation: string;
  status: string;
};

export type AttendedClassesSchedule = {
  class: AttendedSubjectInfo;
  dayAlias: string;
  dayNumber: number;
  subject_id: string;
  periodAlias: string;
  startTimeAlias: string;
  endTimeAlias: string;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

export type Grade = {
  p1?: number | null;
  p2?: number | null;
  pf?: number | null;
  result?: number | null;
};

export type ClassGrade = {
  id: string;
  name: string;
  class: number | string;
  grades: Grade;
};

export interface CurriculumSubject {
  id: string;
  name: string;
  period?: number | null;
  alreadyTaken?: boolean;
  type: 'MANDATORY' | 'DEFINED' | 'UNIVERSAL' | 'RESTRICTED';
  branch?: string;
  credits: number | null;
  workload: number | null;
  minimum_credits: number | null;
  subjectOfPeriod?: boolean;
}

export type PartialRID = {
  id: string;
  name: string;
  classNumber: number | string;
  available: number;
  requested: number;
  position: number;
  status: string;
};

export type Horario = {
  [weekDay in WeekDay]?: Turno[][];
};

type VacanciesType = {
  available: number;
  taken: number;
  requestedAvailable: number;
  requestedTaken: number;
  preferential: number;
};

type ClassVacancies = {
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

export interface SubjectsTaken {
  name: string;
  period: string;
  id: string;
  credits: number | null;
  workload: number | null;
  type: string;
  frequency: number | null;
  grade: number | null;
  status:
    | 'IN_PROGRESS'
    | 'APPROVED'
    | 'FAILED_BY_GRADE'
    | 'FAILED_BY_ATTENDANCE'
    | 'CANCELED'
    | 'EXEMPT';
}

export interface UniversalSubject {
  id: string;
  name: string;
  type: 'UNIVERSAL';
  credits: number | null;
  workload: number | null;
  subjectOfPeriod?: boolean;
}

export type PartialRidResult = { subjects: PartialRID[]; updatedAt: string };
