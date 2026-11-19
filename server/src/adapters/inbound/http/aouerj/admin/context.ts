import type { Student } from '../../../../../modules/students/domain.ts';
import type { Desk, StudentFacts } from './desk.ts';
import type { Html } from './html.ts';
import {
  areaHref,
  type AreaKey,
  type Flash,
  type PaletteEntry,
  type SideCounts,
} from './shell.ts';

/** O que toda página de área recebe. */
export type PageContext = {
  base: string;
  csrf: string;
  now: Date;
  desk: Desk;
  counts: SideCounts;
  palette: PaletteEntry[];
  flash: Flash | null;
  banner: Html | null;
  /** Os alunos que a prévia mostra, abertos. */
  people: ReadonlyMap<string, Student>;
  facts: (id: string) => StudentFacts;
};

/** A URL de uma aba (e do item), sem o que é padrão. */
export function tabHref(
  base: string,
  area: AreaKey,
  tab: string,
  defaultTab: string,
  item?: string | null,
  extra: Record<string, string> = {},
) {
  const query = new URLSearchParams();
  if (tab !== defaultTab) query.set('aba', tab);
  if (item) query.set('item', item);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const search = query.toString();
  return `${areaHref(base, area)}${search ? `?${search}` : ''}`;
}

/** Onde o item está na lista: "2 de 5", o anterior e o próximo. */
export function positionOf(
  ids: readonly string[],
  id: string,
  hrefOf: (id: string) => string,
) {
  const index = ids.indexOf(id);
  if (index < 0) return undefined;
  return {
    index,
    total: ids.length,
    previous: index > 0 ? hrefOf(ids[index - 1]) : null,
    next: index < ids.length - 1 ? hrefOf(ids[index + 1]) : null,
  };
}

/** O escolhido na lista: o pedido, se estiver nela, ou o primeiro. */
export function pick<T>(
  list: readonly T[],
  idOf: (item: T) => string,
  wanted: string | undefined,
) {
  return list.find(item => idOf(item) === wanted) ?? list[0];
}
