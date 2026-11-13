import {
  CurriculumSubject,
  SubjectsTaken,
  SubjectInfo,
  SubjectClassesSchedule,
} from '@root/modules/academics/domain/models';
import type { LunchBreak } from './lunch';

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

/**
 * O que o aluno escolhe no gerador (o formulário da tela). O resto do pedido
 * (turmas, histórico, currículo) vem do que o app leu no Aluno Online.
 */
export type GeneratorDraft = {
  selectedSubjects: CurriculumSubject[];
  busy_schedules: Schedule[];
  /** Minutos livres para o almoço nos dias com aula; `null` desligado. */
  lunchMinutes: number | null;
  /** Teto de disciplinas na grade; `null` = todas as escolhidas. */
  maxSubjects: number | null;
  /** A ordem das grades (um dos `GOALS`). */
  priority: Priority[];
  /** Turmas que o aluno tirou, pela chave de `classKey`. */
  removedClasses: string[];
};

/** "disciplina#turma": a turma nas escolhas do aluno. */
export const classKey = (group: {
  subject_id: string;
  classNumber?: number;
}): string => `${group.subject_id}#${group.classNumber ?? ''}`;

/** O pedido de geração, já com o que o app leu do portal. */
export type ScheduleCreationParams = {
  min_subject_amount: number | null;
  max_subject_amount: number | null;
  busy_schedules: Schedule[];
  /** Horário de almoço; ausente ou `null`, sem a restrição. */
  lunch?: LunchBreak | null;
  priority: Priority[];
  selectedSubjects: CurriculumSubject[];
  takenSubjects: SubjectsTaken[];
  /** Portal-confirmed completion; never supplies fabricated grades or credits. */
  curriculumSubjects?: CurriculumSubject[];
  subjects: SubjectInfo[];
  selectedClasses: SubjectClasses[];
  /**
   * Para `CRITICAL_FIRST`: quantas obrigatórias que faltam cada disciplina
   * trava, direta ou indiretamente, pelo código do portal (`subjects[].id`).
   * Sem ela, a prioridade não muda a ordem.
   */
  criticality?: Readonly<Record<string, number>>;
};

type GeneratedSubject = {
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

/**
 * O que mais importa na ordem das grades. "Mais disciplinas" vem sempre
 * antes, no servidor; aqui fica o desempate.
 */
export type Goal = 'COMPACT' | 'FEW_DAYS' | 'LIGHT_DAYS' | 'ADVANCE';

export const GOALS: Readonly<Record<Goal, readonly Priority[]>> = {
  COMPACT: ['MIN_GAPS', 'MANDATORY_CLASSES'],
  FEW_DAYS: ['LIVES_FAR_AWAY', 'MIN_GAPS'],
  LIGHT_DAYS: ['MIN_DAY_WORKLOAD', 'MIN_GAPS'],
  ADVANCE: ['CRITICAL_FIRST', 'MANDATORY_CLASSES', 'MAX_CREDITS'],
};

/** O objetivo que deu esta ordem, ou `null` se ela não for de nenhum. */
export function goalOf(priority: readonly Priority[]): Goal | null {
  const found = (Object.keys(GOALS) as Goal[]).find(
    goal =>
      GOALS[goal].length === priority.length &&
      GOALS[goal].every((key, index) => key === priority[index]),
  );
  return found ?? null;
}

export const createGeneratorDraft = (): GeneratorDraft => ({
  selectedSubjects: [],
  busy_schedules: [],
  lunchMinutes: null,
  maxSubjects: null,
  priority: [...GOALS.COMPACT],
  removedClasses: [],
});
