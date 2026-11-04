import type { Standing, YouSummary } from './campusNow';

/*
 * Pontos, nível e conquistas. Quem conta é o servidor (os pontos valem na
 * conta, em qualquer aparelho); aqui só a leitura. Não há placar entre
 * alunos: ninguém vê os pontos de ninguém.
 */

/** Do nível 3 em diante, os avisos valem direto, sem esperar confirmação. */
const TRUSTED_LEVEL = 3;

/** Quanto do caminho até o próximo nível já foi (de 0 a 1; 1 no último). */
export function levelProgress(standing: Standing): number {
  if (standing.nextLevelAt === null) return 1;
  const span = standing.nextLevelAt - standing.levelAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (standing.points - standing.levelAt) / span));
}

/** Quantos pontos faltam para o próximo nível (`null` no último). */
export function pointsToNext(standing: Standing): number | null {
  return standing.nextLevelAt === null
    ? null
    : Math.max(0, standing.nextLevelAt - standing.points);
}

export type BadgeId = 'first' | 'checker' | 'helped' | 'trusted';

export type Badge = {
  id: BadgeId;
  done: boolean;
  /** Quanto já foi, até `goal`. */
  progress: number;
  goal: number;
};

/** As conquistas, na ordem da tela; todas saem das contagens de sempre. */
export function badgesOf(summary: Pick<YouSummary, 'counts' | 'you'>): Badge[] {
  const { counts, you } = summary;
  const badge = (id: BadgeId, progress: number, goal: number): Badge => ({
    id,
    done: progress >= goal,
    progress: Math.min(progress, goal),
    goal,
  });
  return [
    badge('first', counts.notices, 1),
    badge('checker', counts.answers, 25),
    badge('helped', counts.viewsReceived, 100),
    badge('trusted', you.level, TRUSTED_LEVEL),
  ];
}

/** O nível subiu entre duas leituras (a primeira vez não conta). */
export function leveledUp(
  before: Pick<Standing, 'level'> | null | undefined,
  after: Pick<Standing, 'level'>,
): boolean {
  return Boolean(before) && after.level > (before?.level ?? after.level);
}
