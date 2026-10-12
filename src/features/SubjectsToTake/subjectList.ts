import { normalizeText } from '@utils/normalize';
import { PORTAL_BLOCKED_FULL_TEXT } from '@components/ui/Feedback/blockedText';

/**
 * Fase de uma lista de disciplinas, derivada do estado da consulta:
 * - `ready`: há um resultado (salvo ou novo, mesmo que vazio); o filtro
 *   pode não encontrar nada, mas avisos de falha ficam com o `QueryNotice`;
 * - `loading`: sem resultado e buscando;
 * - `blocked`: sem resultado e o portal está bloqueado;
 * - `error`: sem resultado e a busca falhou;
 * - `offline`: sem resultado e a consulta está pausada (o `QueryNotice` avisa);
 * - `empty`: sem resultado e sem busca em andamento (consulta desativada).
 */
export type SubjectListPhase =
  'ready' | 'loading' | 'blocked' | 'error' | 'offline' | 'empty';

export type SubjectListQueryState = {
  isLoading: boolean;
  isFetching: boolean;
  isPaused: boolean;
  error: unknown;
};

export function subjectListPhase(
  query: SubjectListQueryState,
  { hasData, blocked }: { hasData: boolean; blocked: boolean },
): SubjectListPhase {
  if (hasData) return 'ready';
  // "Tentar novamente" depois de um erro volta a mostrar o esqueleto
  if (query.isLoading || query.isFetching) return 'loading';
  if (blocked) return 'blocked';
  if (query.error) return 'error';
  if (query.isPaused) return 'offline';
  return 'empty';
}

/** A contagem ("Exibindo N disciplinas") só aparece quando há o que contar. */
export function showsCount(phase: SubjectListPhase): boolean {
  return phase === 'ready' || phase === 'empty';
}

/** Busca sem acento e sem diferenciar maiúsculas, pelo nome ou pelo código. */
export function matchesSubjectSearch(
  search: string,
  subject: { name: string; id: string },
): boolean {
  if (!search) return true;
  const query = normalizeText(search);
  return (
    normalizeText(subject.name).includes(query) ||
    normalizeText(subject.id).includes(query)
  );
}

/** "1 disciplina", "5 disciplinas". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Junta as partes presentes com " · " (o separador das linhas de metadados). */
export function joinMeta(
  parts: ReadonlyArray<string | null | undefined | false>,
): string {
  return parts.filter(Boolean).join(' · ');
}

/** Junta as partes presentes com ", " para leitores de tela. */
export function joinSpoken(
  parts: ReadonlyArray<string | null | undefined | false>,
): string {
  return parts.filter(Boolean).join(', ');
}

/** Textos reais do app para os estados das listas de disciplinas. */
export const SUBJECT_LIST_COPY = {
  listError:
    'Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente.',
  blocked: PORTAL_BLOCKED_FULL_TEXT,
  filterEmpty: 'Nenhuma disciplina encontrada com os filtros selecionados.',
  searchPlaceholder: 'Pesquise pelo nome da disciplina',
  loading: 'Carregando disciplinas…',
  openHint: 'Abre os detalhes da disciplina',
} as const;
