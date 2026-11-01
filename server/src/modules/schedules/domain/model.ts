/**
 * O gerador de grades: das turmas que o aluno pode cursar, as combinações sem
 * choque de horário, ordenadas pelas prioridades dele. Veio do
 * `class-schedule-generator`, com o comportamento que a produção roda.
 */

/** Um horário na semana: o dia (0 a 6) e os minutos desde a meia-noite, com o fim exclusivo. */
export type Interval = { day: number; start: number; end: number };

export type Subject = {
  id: string;
  credits: number;
  /** A carga horária da disciplina no período, em horas. */
  workload: number;
  mandatory: boolean;
  /** O portal deixa cursá-la em choque de horário. */
  allowsConflict: boolean;
  /** Quanto ela trava o curso (quem chama calcula; sem o dado, 0). */
  criticality: number;
  /** Quantas disciplinas dependem dela (idem). */
  blocks: number;
};

/** Uma turma: a disciplina e os horários. */
export type ClassOption = { subjectId: string; intervals: Interval[] };

/**
 * As prioridades que o aluno escolhe, nos nomes do servidor antigo. A
 * primeira da grade é sempre `MOST_SUBJECTS_POSSIBLE`.
 */
export const PRIORITIES = [
  'MOST_SUBJECTS_POSSIBLE',
  'MAX_CREDITS',
  'MAX_WORKLOAD',
  'MIN_WORKLOAD',
  'MAX_DAY_WORKLOAD',
  'MIN_DAY_WORKLOAD',
  'LIVES_FAR_AWAY',
  'MIN_GAPS',
  'MANDATORY_CLASSES',
  'CRITICAL_FIRST',
  'MOST_BLOCKED_FIRST',
] as const;

export type Priority = (typeof PRIORITIES)[number];

export const isPriority = (value: unknown): value is Priority =>
  (PRIORITIES as readonly unknown[]).includes(value);

export type GenerationRequest = {
  subjects: Subject[];
  classes: ClassOption[];
  /** Menos que 1 vale como 1: uma grade vazia não é grade. */
  minSubjects: number;
  maxSubjects: number;
  /** Horários em que o aluno não pode; nem o choque permitido passa por cima. */
  busy: Interval[];
  priorities: Priority[];
};

/** Uma turma escolhida: as posições em `request.classes` e `request.subjects`. */
export type ChosenClass = { classIndex: number; subjectIndex: number };

export type GeneratedSchedule = {
  /** Na ordem das turmas do pedido. */
  classes: ChosenClass[];
  /**
   * A identidade da grade: disciplinas e horários, sem a turma. Duas turmas
   * com o mesmo horário dão a mesma grade, e fica a que veio antes.
   */
  hash: string;
  weekDays: number;
  /** O tempo livre entre as aulas de cada dia, somado na semana. */
  gapMinutes: number;
  credits: number;
  workload: number;
};

export type GenerationResult = {
  schedules: GeneratedSchedule[];
  /** `false` quando o tempo acabou antes de ver todas as combinações. */
  exhaustive: boolean;
  /** Combinações vistas, para o log. */
  visited: number;
};

/** Quantas grades o gerador devolve. */
export const RESULT_LIMIT = 5;

/**
 * O tamanho de um pedido. O app atual manda no máximo 30 turmas e 12
 * disciplinas; os antigos não tinham limite, e o servidor antigo aceitava
 * qualquer número: os limites ficam bem acima disso.
 */
export const GENERATION_LIMITS = {
  classes: 500,
  subjects: 500,
  intervalsPerClass: 50,
  busyIntervals: 500,
  subjectAmount: 100,
  priorities: 20,
  id: 100,
  text: 500,
  listItems: 200,
} as const;

/** O mínimo de disciplinas que vale: abaixo de 1, 1 (uma grade vazia não é grade). */
export const minimumOf = (request: Pick<GenerationRequest, 'minSubjects'>) =>
  Math.max(1, request.minSubjects);

/** O pedido sem saída: nenhuma grade, e a busca nem começou. */
export const noSchedules = (): GenerationResult => ({
  schedules: [],
  exhaustive: true,
  visited: 0,
});
