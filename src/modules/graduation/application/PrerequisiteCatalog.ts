import type { SubjectInfo } from '@root/modules/academics/domain/models';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { AppError, type ErrorCode } from '@root/shared/errors/AppError';

/** Chave das leituras de pré-requisitos nas preferências da conta. */
export const PREREQUISITES_KEY = 'graduation-prerequisites';

/** Pré-requisitos de uma disciplina, como o plano os usa. */
export type PrerequisiteEntry = {
  /** Grupos "ou" de códigos numéricos; todos os grupos valem. */
  groups: string[][];
  /** Créditos obrigatórios da trava ("Trava: 60 Créditos Obrigatórios"). */
  creditLock: number | null;
};

export type PrerequisiteEntries = Readonly<Record<string, PrerequisiteEntry>>;

type Stored = {
  version: 1;
  /** Versão curricular das leituras (`null`: sem a Síntese, desconhecida). */
  curriculum: string | null;
  entries: Record<string, PrerequisiteEntry>;
};

/**
 * Outra versão curricular começa do zero; sem saber a versão (a Síntese não
 * carregou), as leituras guardadas continuam valendo.
 */
const sameCurriculum = (a: string | null, b: string | null) =>
  a === null || b === null || a === b;

export type CatalogProgress = {
  entries: PrerequisiteEntries;
  /** Leituras feitas nesta carga, com ou sem sucesso. */
  done: number;
  /** Leituras que faltavam no começo desta carga. */
  total: number;
  /** Disciplinas cuja página não deu para ler. */
  failed: string[];
  /** O motivo de a carga parar antes do fim (bloqueio, rede, sessão). */
  stoppedBy: ErrorCode | null;
};

/** Erros que param a leitura inteira: insistir só piora. */
const STOP: readonly ErrorCode[] = [
  'POSSIBLY_BLOCKED',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'NETWORK',
  'NOT_LOGGED_IN',
  'LOGIN_FAILED',
  'ACCOUNT_UNAVAILABLE',
  'SESSION_EXPIRED',
  'SESSION_CHANGED',
  'CANCELLED',
];

function keyOf(id: string): string | null {
  try {
    return normalizeSubjectId(id);
  } catch {
    return null;
  }
}

/** Os grupos da Pesquisa de Disciplinas, em códigos numéricos, e a trava. */
export function prerequisiteEntry(details: SubjectInfo): PrerequisiteEntry {
  const groups: string[][] = [];
  let creditLock: number | null = null;
  for (const group of details.prerequisite ?? []) {
    if (!group.length) continue;
    if (group[0].id.toUpperCase().includes('TRAVA')) {
      const credits = Number(group[0].name.match(/\d+/)?.[0]);
      if (Number.isFinite(credits)) {
        creditLock = Math.max(creditLock ?? 0, credits);
      }
      continue;
    }
    const keys = group
      .map(item => keyOf(item.id))
      .filter((key): key is string => key !== null);
    if (keys.length) groups.push([...new Set(keys)]);
  }
  return { groups, creditLock };
}

const isEntry = (value: unknown): value is PrerequisiteEntry => {
  const entry = value as PrerequisiteEntry | null;
  return (
    !!entry &&
    Array.isArray(entry.groups) &&
    entry.groups.every(
      group =>
        Array.isArray(group) && group.every(key => typeof key === 'string'),
    ) &&
    (entry.creditLock === null ||
      (typeof entry.creditLock === 'number' &&
        Number.isFinite(entry.creditLock)))
  );
};

/** As leituras guardadas desta versão curricular, sem confiar no formato. */
function storedEntries(raw: unknown, curriculum: string | null) {
  const stored = raw as Stored | null;
  if (
    !stored ||
    stored.version !== 1 ||
    (typeof stored.curriculum !== 'string' && stored.curriculum !== null) ||
    !sameCurriculum(stored.curriculum, curriculum) ||
    !stored.entries ||
    typeof stored.entries !== 'object'
  ) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(stored.entries).filter(([, entry]) => isEntry(entry)),
  ) as Record<string, PrerequisiteEntry>;
}

/**
 * Pré-requisitos das disciplinas que faltam, lidos aos poucos na Pesquisa de
 * Disciplinas (uma página por disciplina) e guardados por versão curricular:
 * uma leitura interrompida continua de onde parou, e as seguintes abrem na
 * hora. São dados do currículo, mas ficam na conta e saem com o logout.
 */
export class PrerequisiteCatalog {
  constructor(
    private readonly store: PreferencesStore,
    private readonly concurrency = 2,
  ) {}

  async read(
    scope: string,
    curriculum: string | null,
  ): Promise<PrerequisiteEntries> {
    return storedEntries(
      await this.store.read<Stored>(scope, PREREQUISITES_KEY),
      curriculum,
    );
  }

  /** Esquece as leituras: a próxima carga lê tudo de novo. */
  forget(scope: string): Promise<void> {
    return this.store.remove(scope, PREREQUISITES_KEY);
  }

  async load(
    scope: string,
    curriculum: string | null,
    subjectIds: readonly string[],
    fetch: (subjectId: string, signal: AbortSignal) => Promise<SubjectInfo>,
    signal: AbortSignal,
    onProgress: (progress: CatalogProgress) => void,
  ): Promise<CatalogProgress> {
    const entries: Record<string, PrerequisiteEntry> = {
      ...(await this.read(scope, curriculum).catch(() => ({}))),
    };
    const missing = [
      ...new Map(
        subjectIds
          .map(id => [keyOf(id), id] as const)
          .filter(([key]) => key !== null && !entries[key]),
      ).values(),
    ];
    const failed: string[] = [];
    let stoppedBy: ErrorCode | null = null;
    let done = 0;
    let next = 0;
    const progress = (): CatalogProgress => ({
      entries: { ...entries },
      done,
      total: missing.length,
      failed: [...failed],
      stoppedBy,
    });
    onProgress(progress());

    const worker = async () => {
      while (next < missing.length && !stoppedBy && !signal.aborted) {
        const subjectId = missing[next++];
        const key = keyOf(subjectId) as string;
        try {
          const entry = prerequisiteEntry(await fetch(subjectId, signal));
          if (signal.aborted) return;
          entries[key] = entry;
          await this.store
            .update<Stored>(scope, PREREQUISITES_KEY, current => {
              const kept = storedEntries(current, curriculum);
              // sem a versão agora, fica a das leituras que continuam valendo
              const known = Object.keys(kept).length
                ? (current?.curriculum ?? null)
                : null;
              return {
                version: 1,
                curriculum: curriculum ?? known,
                entries: { ...kept, [key]: entry },
              };
            })
            // sem gravar, a leitura vale nesta abertura e se repete na próxima
            .catch(() => undefined);
        } catch (error) {
          if (signal.aborted) return;
          const code = error instanceof AppError ? error.code : null;
          if (code && STOP.includes(code)) stoppedBy = code;
          else failed.push(subjectId);
        }
        done += 1;
        onProgress(progress());
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(Math.max(1, this.concurrency), missing.length) },
        worker,
      ),
    );
    return progress();
  }
}
