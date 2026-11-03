/*
 * O Início do jeito de cada um: quais seções aparecem e em que ordem, a
 * saudação, a densidade e alguns detalhes de cada seção. Fica só no
 * aparelho, por conta, e vale na hora.
 */

/** Preferência da conta onde o layout fica (o logout apaga). */
export const HOME_LAYOUT_KEY = 'home-layout';

/** As seções que o aluno arruma (a ordem aqui é a do padrão). */
export const HOME_SECTIONS = [
  'next-class',
  'companion',
  'evaluations',
  'grades',
  'week',
] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

/** `full`: "Olá, Marina" e a data. `date`: só a data. `none`: nada. */
export type GreetingStyle = 'full' | 'date' | 'none';
export const GREETING_STYLES: readonly GreetingStyle[] = [
  'full',
  'date',
  'none',
];

/** `comfortable`: o espaço do app. `compact`: as seções mais juntas. */
export type HomeDensity = 'comfortable' | 'compact';

/** Quantas avaliações a seção mostra antes de "Ver todas". */
export const EVALUATION_LIMITS = [1, 3, 5] as const;
export type EvaluationLimit = (typeof EVALUATION_LIMITS)[number];

export type HomeLayout = {
  /** Todas as seções, na ordem em que aparecem. */
  order: HomeSectionId[];
  /** As que o aluno escondeu. */
  hidden: HomeSectionId[];
  greeting: GreetingStyle;
  density: HomeDensity;
  /** O botão "Ver no mapa" abaixo da próxima aula. */
  nextClassMap: boolean;
  evaluationLimit: EvaluationLimit;
};

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  order: [...HOME_SECTIONS],
  hidden: [],
  greeting: 'full',
  density: 'comfortable',
  nextClassMap: true,
  evaluationLimit: 3,
};

const isSection = (value: unknown): value is HomeSectionId =>
  HOME_SECTIONS.includes(value as HomeSectionId);

/**
 * A cópia salva, sem confiar no formato: o que faltar fica no padrão. Uma
 * seção nova (de uma versão mais nova do app) entra no lugar dela no padrão,
 * visível; uma desconhecida sai.
 */
export function normalizeHomeLayout(raw: unknown): HomeLayout {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const saved = Array.isArray(value.order)
    ? value.order
        .filter(isSection)
        .filter((id, i, all) => all.indexOf(id) === i)
    : [];
  const order = [...saved];
  HOME_SECTIONS.forEach((id, index) => {
    if (order.includes(id)) return;
    // depois da que vinha antes dela no padrão
    const before = HOME_SECTIONS.slice(0, index)
      .reverse()
      .find(previous => order.includes(previous));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  const hidden = Array.isArray(value.hidden)
    ? value.hidden
        .filter(isSection)
        .filter((id, i, all) => all.indexOf(id) === i)
    : [];
  return {
    order,
    hidden,
    greeting: GREETING_STYLES.includes(value.greeting as GreetingStyle)
      ? (value.greeting as GreetingStyle)
      : DEFAULT_HOME_LAYOUT.greeting,
    density:
      value.density === 'compact' || value.density === 'comfortable'
        ? value.density
        : DEFAULT_HOME_LAYOUT.density,
    nextClassMap:
      typeof value.nextClassMap === 'boolean'
        ? value.nextClassMap
        : DEFAULT_HOME_LAYOUT.nextClassMap,
    evaluationLimit: EVALUATION_LIMITS.includes(
      value.evaluationLimit as EvaluationLimit,
    )
      ? (value.evaluationLimit as EvaluationLimit)
      : DEFAULT_HOME_LAYOUT.evaluationLimit,
  };
}

/** Sobe (`-1`) ou desce (`+1`) uma seção entre as que o aluno vê na lista. */
export function moveSection(
  layout: HomeLayout,
  id: HomeSectionId,
  delta: -1 | 1,
  available: readonly HomeSectionId[] = HOME_SECTIONS,
): HomeLayout {
  const listed = layout.order.filter(item => available.includes(item));
  const index = listed.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= listed.length) return layout;
  const swapped = [...listed];
  [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
  // as que não estão na lista (indisponíveis no aparelho) ficam onde estavam
  let next = 0;
  const order = layout.order.map(item =>
    available.includes(item) ? swapped[next++] : item,
  );
  return { ...layout, order };
}

export function setSectionVisible(
  layout: HomeLayout,
  id: HomeSectionId,
  visible: boolean,
): HomeLayout {
  const hidden = layout.hidden.filter(item => item !== id);
  return { ...layout, hidden: visible ? hidden : [...hidden, id] };
}

export const isSectionVisible = (layout: HomeLayout, id: HomeSectionId) =>
  !layout.hidden.includes(id);

/** As seções que aparecem, na ordem; `available` tira as que o aparelho não tem. */
export function visibleSections(
  layout: HomeLayout,
  available: readonly HomeSectionId[] = HOME_SECTIONS,
): HomeSectionId[] {
  return layout.order.filter(
    id => available.includes(id) && isSectionVisible(layout, id),
  );
}

/** O layout é o do padrão (o "Restaurar" fica sem efeito). */
export const isDefaultLayout = (layout: HomeLayout) =>
  JSON.stringify(layout) === JSON.stringify(DEFAULT_HOME_LAYOUT);
