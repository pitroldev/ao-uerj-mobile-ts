import type {
  AttendedClassesSchedule,
  CurriculumSubject,
  GraduationSynthesis,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';

/** Preferências em memória, com a fila de uma operação por vez do app. */
export function memoryStore() {
  const data = new Map<string, unknown>();
  let queue: Promise<unknown> = Promise.resolve();
  const store: PreferencesStore = {
    read: async <T>(scope: string, key: string) =>
      (data.get(`${scope}:${key}`) as T | undefined) ?? null,
    write: async (scope, key, value) => {
      data.set(`${scope}:${key}`, JSON.parse(JSON.stringify(value)));
    },
    // uma operação por vez, como a fila por chave do createPreferencesStore
    update: <T>(
      scope: string,
      key: string,
      change: (current: T | null) => T,
    ) => {
      const task = queue
        .catch(() => undefined)
        .then(async () => {
          const next = change((data.get(`${scope}:${key}`) as T) ?? null);
          data.set(`${scope}:${key}`, JSON.parse(JSON.stringify(next)));
          return next;
        });
      queue = task;
      return task;
    },
    remove: async (scope, key) => {
      data.delete(`${scope}:${key}`);
    },
  };
  return { store, data };
}

const mandatory = (
  id: string,
  name: string,
  period: number,
): CurriculumSubject => ({
  id,
  name,
  period,
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
});

/**
 * Um currículo de mentira: Cálculo I cursada; Cálculo II trava Cálculo III,
 * que trava Cálculo IV e Equações Diferenciais. A cadeia dita o plano:
 * 2026.2 (II), 2027.1 (III) e 2027.2 (IV e Equações).
 */
export const PLAN_CURRICULUM: CurriculumSubject[] = [
  mandatory('IME01-10001', 'Cálculo I', 1),
  mandatory('IME01-10002', 'Cálculo II', 2),
  mandatory('IME01-10003', 'Cálculo III', 3),
  mandatory('IME01-10004', 'Cálculo IV', 4),
  mandatory('IME01-10005', 'Equações Diferenciais', 4),
];

export const PLAN_HISTORY: SubjectsTaken[] = [
  {
    id: 'IME01-10001',
    name: 'Cálculo I',
    period: '2025/2',
    credits: 4,
    workload: 60,
    type: 'Obrigatória',
    frequency: 100,
    grade: 8,
    status: 'APPROVED',
  },
];

/** O que a Pesquisa de Disciplinas mostra de cada uma. */
const PLAN_PREREQUISITES: Record<string, SubjectInfo['prerequisite']> = {
  'IME01-10002': [[{ id: 'IME01-10001', name: 'Cálculo I' }]],
  'IME01-10003': [[{ id: 'IME01-10002', name: 'Cálculo II' }]],
  'IME01-10004': [[{ id: 'IME01-10003', name: 'Cálculo III' }]],
  'IME01-10005': [[{ id: 'IME01-10003', name: 'Cálculo III' }]],
};

export const planDetails = (subjectId: string): SubjectInfo => ({
  id: subjectId,
  prerequisite: PLAN_PREREQUISITES[subjectId] ?? [],
});

/** A Síntese: 6 períodos usados (2026.1 em curso), 6 restantes. */
export function planSynthesis(
  periods: Partial<GraduationSynthesis['periods']> = {},
): GraduationSynthesis {
  return {
    curriculumVersion: '2',
    regime: 'Crédito',
    cr: null,
    requirements: [
      {
        kind: 'MANDATORY',
        label: 'Grupo de Obrigatórias',
        branch: null,
        done: 4,
        required: 20,
      },
      {
        kind: 'ELECTIVES',
        label: 'Total de Eletivas',
        branch: null,
        done: 8,
        required: 8,
      },
    ],
    periods: {
      minimum: 8,
      used: 6,
      maximum: 12,
      remaining: 6,
      extra: 0,
      ...periods,
    },
    currentPeriod: '2026.1',
  };
}

/** Uma aula da grade do período: a disciplina conta como em curso. */
export const scheduleOf = (
  subjectId: string,
  name: string,
): AttendedClassesSchedule => ({
  class: {
    id: subjectId,
    name,
    class: '1',
    avaLocation: '',
    uerjLocation: '',
    status: '',
  },
  dayAlias: 'Segunda',
  dayNumber: 1,
  subject_id: subjectId,
  periodAlias: 'M1',
  startTimeAlias: '07:00',
  endTimeAlias: '07:50',
  start_time_in_minutes: 420,
  end_time_in_minutes: 470,
});
