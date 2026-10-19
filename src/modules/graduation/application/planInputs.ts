import type {
  CurriculumSubject,
  GraduationSynthesis,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { completedSubjectIds } from '@root/modules/academics/domain/rules/completion';
import {
  calculateAcademicProgress,
  type ElectiveCreditsConfig,
} from '@root/modules/academics/domain/rules/progress';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import {
  electiveSlots,
  type PlanSubject,
  type PlanSubjectKind,
} from '../domain/plan';
import { periodAfter, planIndexOf } from '../domain/periods';
import type { PrerequisiteEntries } from './PrerequisiteCatalog';
import type { Postponement } from './PlanPreferencesStore';

export type PlanSources = {
  curriculum: readonly CurriculumSubject[];
  history: readonly SubjectsTaken[];
  /** Códigos das disciplinas em curso (a grade do período): contam como aprovadas. */
  inProgress: readonly string[];
  synthesis: GraduationSynthesis | null;
  /** Créditos de eletivas configurados em Meu Progresso, sem a Síntese. */
  electiveCredits: ElectiveCreditsConfig;
};

export type PlanInputs = {
  /** As obrigatórias que faltam, fora as em curso. */
  remaining: CurriculumSubject[];
  /** Aprovadas, isentas e em curso. */
  completed: Set<string>;
  /** Créditos obrigatórios aprovados com os em curso (o que as travas contam). */
  mandatoryCredits: number;
  /** Vagas de eletiva para completar os créditos exigidos. */
  electives: PlanSubject[];
};

const ELECTIVE_NAMES: Record<Exclude<PlanSubjectKind, 'MANDATORY'>, string> = {
  RESTRICTED: 'Eletiva Restrita',
  DEFINED: 'Eletiva Definida',
  UNIVERSAL: 'Eletiva Universal',
  ELECTIVE: 'Eletiva',
};
const ELECTIVE_KINDS = ['RESTRICTED', 'DEFINED', 'UNIVERSAL'] as const;
/** O tamanho de vaga sem nenhuma disciplina do grupo para comparar. */
const DEFAULT_SLOT_CREDITS = 4;

function keyOf(id: string): string | null {
  try {
    return normalizeSubjectId(id);
  } catch {
    return null;
  }
}

const positive = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/** Os créditos mais comuns entre as disciplinas do grupo no currículo. */
function usualCredits(
  curriculum: readonly CurriculumSubject[],
  kind: CurriculumSubject['type'],
) {
  const counts = new Map<number, number>();
  curriculum
    .filter(item => item.type === kind && positive(item.credits))
    .forEach(item =>
      counts.set(item.credits!, (counts.get(item.credits!) ?? 0) + 1),
    );
  let best = DEFAULT_SLOT_CREDITS;
  let most = 0;
  counts.forEach((count, credits) => {
    if (count > most) {
      best = credits;
      most = count;
    }
  });
  return best;
}

/** Créditos que faltam em cada grupo de eletivas e no total, se houver. */
function missingElectives(sources: PlanSources) {
  const missing: Record<(typeof ELECTIVE_KINDS)[number], number> = {
    RESTRICTED: 0,
    DEFINED: 0,
    UNIVERSAL: 0,
  };
  let total = 0;
  const { synthesis } = sources;
  if (synthesis?.requirements.length) {
    for (const requirement of synthesis.requirements) {
      const left = Math.max(
        0,
        positive(requirement.required) - positive(requirement.done),
      );
      if (requirement.kind === 'ELECTIVES') total = left;
      else if (requirement.kind !== 'MANDATORY' && requirement.kind !== 'OTHER')
        missing[requirement.kind] += left;
    }
  } else {
    const { byType } = calculateAcademicProgress(
      sources.history,
      sources.curriculum,
      sources.electiveCredits,
    );
    for (const kind of ELECTIVE_KINDS) {
      const required = byType.requiredCredits[kind];
      if (required !== null) {
        missing[kind] = Math.max(0, required - byType.completedCredits[kind]);
      }
    }
  }
  return { missing, total };
}

/** O que o plano precisa saber, a partir do que o app já lê do portal. */
export function planInputs(sources: PlanSources): PlanInputs {
  const { curriculum, history, synthesis } = sources;
  const inProgress = new Set(
    [
      ...sources.inProgress,
      ...history
        .filter(item => item.status === 'IN_PROGRESS')
        .map(item => item.id),
    ]
      .map(keyOf)
      .filter((key): key is string => key !== null),
  );
  const completed = completedSubjectIds(history, curriculum);
  inProgress.forEach(key => completed.add(key));

  const byKey = new Map<string, CurriculumSubject>();
  for (const item of curriculum) {
    const key = keyOf(item.id);
    if (key !== null && !byKey.has(key)) byKey.set(key, item);
  }
  const remaining = [...byKey.entries()]
    .filter(([key, item]) => item.type === 'MANDATORY' && !completed.has(key))
    .map(([, item]) => item);

  // créditos das em curso, pelo currículo (as que ele não lista ficam de fora)
  const current = [...inProgress]
    .map(key => byKey.get(key))
    .filter((item): item is CurriculumSubject => item !== undefined);
  const currentCredits = (kind: CurriculumSubject['type']) =>
    current
      .filter(item => item.type === kind)
      .reduce((sum, item) => sum + positive(item.credits), 0);

  const mandatoryDone = synthesis?.requirements.some(
    item => item.kind === 'MANDATORY' && item.done !== null,
  )
    ? synthesis.requirements
        .filter(item => item.kind === 'MANDATORY')
        .reduce((sum, item) => sum + positive(item.done), 0)
    : calculateAcademicProgress(history, curriculum, sources.electiveCredits)
        .byType.completedCredits.MANDATORY;

  const { missing, total } = missingElectives(sources);
  const electives: PlanSubject[] = [];
  let planned = 0;
  for (const kind of ELECTIVE_KINDS) {
    const left = Math.max(0, missing[kind] - currentCredits(kind));
    planned += left;
    electives.push(
      ...electiveSlots(
        kind,
        left,
        usualCredits(curriculum, kind),
        ELECTIVE_NAMES[kind],
      ),
    );
  }
  // o total de eletivas pode pedir mais que a soma dos grupos
  const inProgressElectives = ELECTIVE_KINDS.reduce(
    (sum, kind) => sum + currentCredits(kind),
    0,
  );
  const extra = Math.max(0, total - inProgressElectives - planned);
  electives.push(
    ...electiveSlots(
      'ELECTIVE',
      extra,
      usualCredits(curriculum, 'RESTRICTED'),
      ELECTIVE_NAMES.ELECTIVE,
    ),
  );

  return {
    remaining,
    completed,
    mandatoryCredits: mandatoryDone + currentCredits('MANDATORY'),
    electives,
  };
}

/** Uma obrigatória do currículo como o plano a usa, com os pré-requisitos lidos. */
export function planSubject(
  item: CurriculumSubject,
  entries: PrerequisiteEntries,
): PlanSubject {
  const key = keyOf(item.id) ?? item.id;
  const entry = entries[key];
  return {
    key,
    id: item.id,
    name: item.name,
    credits: positive(item.credits),
    workload: item.workload,
    kind: 'MANDATORY',
    recommendedPeriod: item.period ?? null,
    minimumCredits: Math.max(
      positive(item.minimum_credits),
      positive(entry?.creditLock),
    ),
    prerequisites: entry ? entry.groups : null,
    placeholder: false,
  };
}

/** Os adiamentos guardados como índices do plano que começa depois de `current`. */
export function postponementIndexes(
  postponed: Readonly<Record<string, Postponement>>,
  current: string | null,
): Map<string, number> {
  const indexes = new Map<string, number>();
  Object.entries(postponed).forEach(([key, value]) => {
    const index =
      'period' in value
        ? current === null
          ? null
          : planIndexOf(current, value.period)
        : value.index;
    if (index !== null && index > 0) indexes.set(key, index);
  });
  return indexes;
}

/** Como guardar "a partir do índice": o período, quando ele é conhecido. */
export function postponementAt(
  index: number,
  current: string | null,
): Postponement {
  const period = current === null ? null : periodAfter(current, index + 1);
  return period === null ? { index } : { period };
}
