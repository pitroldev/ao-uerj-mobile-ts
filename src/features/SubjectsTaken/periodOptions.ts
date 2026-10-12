import type { SelectOption } from '@components/ui';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import {
  calculateCraProgression,
  getPeriodList,
} from '@root/modules/academics/domain/rules/progress';

/** "7,77" (duas casas, vírgula), como o CR aparece no app. */
function formatCra(cra: number): string {
  return cra.toFixed(2).replace('.', ',');
}

/**
 * Opções do seletor de período (mais recente primeiro, como em
 * `getPeriodList`), com o CR acumulado à direita: "Em curso" no período que
 * ainda tem disciplinas em andamento, "CR atual 7,77" no último período
 * encerrado e "CR 7,65" nos anteriores. Períodos de isenção ficam sem CR.
 * Os valores de CR vêm das regras de domínio (`calculateCraProgression`).
 */
export function buildPeriodOptions(
  subjects: readonly SubjectsTaken[],
): SelectOption[] {
  const craByPeriod = new Map(
    calculateCraProgression(subjects).pointsOverTime.map(point => [
      point.label,
      point.cra,
    ]),
  );
  const inProgress = new Set(
    subjects
      .filter(subject => subject.status === 'IN_PROGRESS')
      .map(subject => subject.period),
  );
  let currentMarked = false;
  return getPeriodList(subjects).map(({ value }) => {
    if (inProgress.has(value))
      return { value, label: value, aside: 'Em curso' };
    const cra = craByPeriod.get(value);
    if (cra === undefined) return { value, label: value };
    const prefix = currentMarked ? 'CR' : 'CR atual';
    currentMarked = true;
    return { value, label: value, aside: `${prefix} ${formatCra(cra)}` };
  });
}
