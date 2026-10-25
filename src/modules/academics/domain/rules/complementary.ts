import type {
  ComplementaryActivities,
  ComplementaryActivity,
  GraduationSynthesis,
} from '../models';

export type ComplementaryType = {
  type: string;
  /** Horas que contam deste tipo (até o teto). */
  counted: number;
  /** Teto do tipo ("CH Máxima"); `null` sem o resumo do portal. */
  maximum: number | null;
  /** Horas registradas acima do teto, que não contam. */
  excess: number;
  activities: ComplementaryActivity[];
};

export type ComplementarySummary = {
  /** Horas que contam, somadas por tipo. */
  counted: number;
  /** Horas acima do teto de cada tipo, que não contam. */
  excess: number;
  /** Carga exigida pela Síntese da Formação, quando ela informa. */
  required: number | null;
  /**
   * O que conta para a exigência: o cumprido da Síntese, que é o oficial e
   * inclui horas que "Disciplinas Realizadas" não detalha; sem ele, a soma
   * por tipo.
   */
  progress: number;
  types: ComplementaryType[];
};

const positive = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/**
 * Horas complementares por tipo de atividade. O resumo do portal ("Resumo por
 * Tipo de Atividade") decide o que conta: cada tipo só até o teto. Sem ele,
 * soma as atividades, com o teto quando conhecido. A carga exigida vem do
 * requisito "complementar" da Síntese, se o currículo tiver um. `null` quando
 * não há atividade, resumo nem exigência: nada a mostrar.
 */
export function summarizeComplementary(
  data: ComplementaryActivities | undefined,
  synthesis?: GraduationSynthesis | null,
): ComplementarySummary | null {
  const requirement = synthesis?.requirements.find(item =>
    /complementar/i.test(item.label),
  );
  const required = requirement?.required ?? null;
  const activities = data?.activities ?? [];
  const byType = data?.byType ?? [];
  if (!activities.length && !byType.length && !positive(required)) return null;

  const names = [
    ...new Set([
      ...byType.map(item => item.type),
      ...activities.map(item => item.type),
    ]),
  ];
  const types = names.map((type): ComplementaryType => {
    const own = activities.filter(item => item.type === type);
    const summary = byType.find(item => item.type === type);
    const registered = own.reduce((sum, item) => sum + positive(item.hours), 0);
    const maximum = summary?.maximum ?? null;
    const capped =
      maximum === null ? registered : Math.min(registered, positive(maximum));
    return {
      type,
      counted: summary?.counted ?? capped,
      maximum,
      excess: summary?.excess ?? Math.max(0, registered - capped),
      activities: own,
    };
  });
  const counted = types.reduce((sum, item) => sum + positive(item.counted), 0);
  const official = requirement?.done;
  return {
    counted,
    excess: types.reduce((sum, item) => sum + positive(item.excess), 0),
    required: positive(required) ? required : null,
    progress:
      typeof official === 'number' && Number.isFinite(official) && official >= 0
        ? official
        : counted,
    types,
  };
}
