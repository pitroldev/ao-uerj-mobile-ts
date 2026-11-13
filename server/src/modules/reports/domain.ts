/**
 * Relatos de erro do app. Os anexos vão para arquivo e o relato, para o
 * banco, com os ids dos anexos. Desde a 2.0 o anexo é um JSON de diagnóstico;
 * o da 1.x era a página do portal, com dados pessoais.
 */

export type NewErrorReport = {
  page: string;
  description?: string;
  email?: string;
  attachments: string[];
  /** O aluno que relatou (v2, com a sessão); a rota antiga não sabe. */
  studentId?: string | null;
};

export type ErrorReport = {
  id: string;
  page: string;
  description?: string;
  email?: string;
  /** O aluno que relatou; `null` na rota antiga. */
  studentId?: string | null;
  attachmentIds: string[];
  /** Quando foi dado como resolvido na administração; aberto, `null`. */
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * O anexo dos apps 2.x: um JSON de diagnóstico, sem dado pessoal (o app
 * escolhe os campos). O da 1.x é a página do portal, em HTML.
 */
export type Diagnostic = {
  operation: string;
  category: string;
  appVersion: string;
  parserVersion: string;
  /** A atualização OTA que o app rodava (desde a 2.16.2); sem ela, o JS da loja. */
  updateId?: string;
  subjectCode?: string;
  eventId?: string;
  /** A última tentativa no gerador de grades, em contagens (relato do gerador). */
  generator?: GeneratorRun;
};

/** As contagens que o app manda da última tentativa no gerador. */
export type GeneratorRun = {
  step: number;
  outcome: string;
  /** O que o aluno pediu na ordem das grades ("COMPACT", "FEW_DAYS"…). */
  goal?: string;
} & Partial<Record<(typeof GENERATOR_COUNTS)[number], number>>;

const GENERATOR_COUNTS = [
  'maximumSubjects',
  'busySlots',
  'saturdayBusySlots',
  'lunchMinutes',
  'chosenSubjects',
  'universalSubjects',
  'eligibleSubjects',
  'refusedSubjects',
  'failedSubjects',
  'classes',
  'freeClasses',
  'subjectsWithFreeClass',
  'removedClasses',
  'schedules',
  'largestSchedule',
] as const;

const text = (value: unknown, max = 200) =>
  typeof value === 'string' && value.length <= max ? value : undefined;

const count = (value: unknown, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max
    ? value
    : undefined;

/** Só as contagens conhecidas e um resultado em maiúsculas. */
function parseGeneratorRun(value: unknown): GeneratorRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const step = count(raw.step, 20);
  const outcome = text(raw.outcome, 40);
  if (step === undefined || !outcome || !/^[A-Z_]+$/.test(outcome))
    return undefined;
  const run: GeneratorRun = { step, outcome };
  const goal = text(raw.goal, 40);
  if (goal && /^[A-Z_]+$/.test(goal)) run.goal = goal;
  for (const key of GENERATOR_COUNTS) {
    const found = count(raw[key], 10000);
    if (found !== undefined) run[key] = found;
  }
  return run;
}

/** O diagnóstico de um anexo, ou `null` se ele não for um (HTML da 1.x). */
export function parseDiagnostic(content: string): Diagnostic | null {
  if (!content.trimStart().startsWith('{')) return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1)
    return null;
  const operation = text(value.operation);
  const category = text(value.category);
  const appVersion = text(value.appVersion, 40);
  const parserVersion = text(value.parserVersion, 40);
  if (!operation || !category || !appVersion || !parserVersion) return null;
  const updateId = text(value.updateId, 64);
  const subjectCode = text(value.subjectCode, 40);
  const eventId = text(value.eventId, 64);
  const generator = parseGeneratorRun(value.generator);
  return {
    operation,
    category,
    appVersion,
    parserVersion,
    ...(updateId ? { updateId } : {}),
    ...(subjectCode ? { subjectCode } : {}),
    ...(eventId ? { eventId } : {}),
    ...(generator ? { generator } : {}),
  };
}

/**
 * A tela dos relatos antigos que chegaram sem ela (na produção, 6 de 76, de
 * antes de o servidor exigir o campo).
 */
export const UNKNOWN_PAGE = 'Sem tela';

/** A situação de um relato na triagem. */
export type ReviewStatus = 'open' | 'resolved' | 'all';

/** O recorte da triagem: a situação e, opcional, a tela. */
export type ReviewFilter = { status: ReviewStatus; page?: string };

/** Quantos relatos há de cada tela, abertos e resolvidos. */
export type ReviewSummary = {
  open: number;
  resolved: number;
  pages: Array<{ page: string; open: number; resolved: number }>;
};

/** A triagem mostra até estes relatos por vez (os mais recentes). */
export const REVIEW_LIMIT = 100;

/** Bem acima do que os apps mandam (o atual corta a descrição em 4000). */
export const REPORT_LIMITS = {
  page: 200,
  description: 20000,
  email: 254,
  attachments: 10,
} as const;

/** A listagem de administração traz os mais recentes, no máximo estes. */
export const RECENT_REPORTS = 100;
