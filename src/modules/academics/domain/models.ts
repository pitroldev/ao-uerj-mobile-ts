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

/** Uma disciplina em "RID: Resultado da Inscrição". */
export type EnrollmentResultEntry = {
  id: string;
  name: string;
  classNumber: string;
  accepted: boolean;
  /** Motivo de uma inscrição não aceita ("Falta Requisito (CO/PRE)"). */
  reason: string;
};

export type EnrollmentResult = { subjects: EnrollmentResultEntry[] };

/** Grupo de um requisito do currículo na Síntese da Formação. */
export type SynthesisRequirementKind =
  'MANDATORY' | 'RESTRICTED' | 'DEFINED' | 'UNIVERSAL' | 'ELECTIVES' | 'OTHER';

export type SynthesisRequirement = {
  kind: SynthesisRequirementKind;
  /** Texto do portal, sem o marcador ("Grupo de Obrigatórias"). */
  label: string;
  /** Ramificação do grupo de obrigatórias, quando o portal a mostra acima dele. */
  branch: string | null;
  /** Em créditos, no regime de crédito. */
  done: number | null;
  required: number | null;
};

/** "Síntese da Formação" do Aluno Online: currículo, CR oficial e prazo. */
export type GraduationSynthesis = {
  /** "1 - Currículo de Engenharia de 2006 (FEN)". */
  curriculumVersion: string | null;
  /** "Crédito" ou "Seriado". */
  regime: string | null;
  /** Coeficiente de Rendimento oficial. */
  cr: number | null;
  requirements: SynthesisRequirement[];
  /** Períodos Letivos para a integralização curricular. */
  periods: {
    minimum: number | null;
    /** Cursados e o em curso; trancados e concomitância ficam de fora. */
    used: number | null;
    maximum: number | null;
    /** Já com os extras concedidos: máximo + extras − utilizados. */
    remaining: number | null;
    extra: number | null;
  };
  /** Período em curso (a linha "Inscrito"), "2026.1"; `null` entre períodos. */
  currentPeriod: string | null;
};
