import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import { readySubjects } from '@root/modules/planning/domain/availability';
import { lunchBreak } from '@root/modules/planning/domain/lunch';
import {
  goalOf,
  type GeneratorDraft,
} from '@root/modules/planning/domain/models';
import { routineFit } from '@root/modules/planning/domain/rules';
import {
  useGeneratorRunNote,
  useGeneratorRunStart,
} from '@root/modules/planning/presentation/useGeneratorRun';
import { usePlanningCatalog } from '@root/modules/planning/presentation/usePlanningCatalog';

/** Sábado no gerador (0 = segunda). */
const SATURDAY = 5;

const NO_SUBJECTS: CurriculumSubject[] = [];

/**
 * Anota, para o relato da tela, o passo e as escolhas da tentativa atual,
 * só em contagens. Fica fora dos passos para não redesenhá-los a cada toque.
 */
export function GeneratorRunRecorder({ step }: { step: number }) {
  const start = useGeneratorRunStart();
  const note = useGeneratorRunNote();
  const { control } = useFormContext<GeneratorDraft>();
  const [busy, lunchMinutes, maximum, priority, chosen, removed] = useWatch({
    control,
    name: [
      'busy_schedules',
      'lunchMinutes',
      'maxSubjects',
      'priority',
      'selectedSubjects',
      'removedClasses',
    ],
  });
  const selectedSubjects = chosen ?? NO_SUBJECTS;
  const catalog = usePlanningCatalog(selectedSubjects);

  useEffect(() => {
    start();
  }, [start]);

  // um passo novo zera o resultado; o passo final anota o dele
  useEffect(() => {
    note({ step, outcome: 'NOT_RUN' });
  }, [note, step]);

  const goal = goalOf(priority ?? []);
  const universal = selectedSubjects.filter(
    subject => subject.type === 'UNIVERSAL',
  ).length;
  useEffect(() => {
    note({
      maximumSubjects: maximum ?? undefined,
      busySlots: busy?.length ?? 0,
      saturdayBusySlots: (busy ?? []).filter(b => b.week_day === SATURDAY)
        .length,
      lunchMinutes: lunchMinutes ?? 0,
      goal: goal ?? 'CUSTOM',
      chosenSubjects: selectedSubjects.length,
      universalSubjects: universal,
      removedClasses: removed?.length ?? 0,
    });
  }, [
    note,
    maximum,
    busy,
    lunchMinutes,
    goal,
    selectedSubjects,
    universal,
    removed,
  ]);

  // o que o portal disse das escolhidas e o que a rotina deixa
  const states = [...catalog.availability.values()];
  const refused = states.filter(state => state.status === 'refused').length;
  const failed = catalog.failed;
  const ready = readySubjects({ selectedSubjects }, catalog.availability);
  const fit = routineFit(ready, busy ?? [], lunchBreak(lunchMinutes));
  const classes = fit.reduce((sum, subject) => sum + subject.classes, 0);
  const freeClasses = fit.reduce((sum, subject) => sum + subject.free, 0);
  const withFreeClass = fit.filter(subject => subject.free > 0).length;
  const settled = catalog.loading === 0;
  useEffect(() => {
    if (!settled) return;
    note({
      eligibleSubjects: ready.length,
      refusedSubjects: refused,
      failedSubjects: failed,
      classes,
      freeClasses,
      subjectsWithFreeClass: withFreeClass,
    });
  }, [
    note,
    settled,
    ready.length,
    refused,
    failed,
    classes,
    freeClasses,
    withFreeClass,
  ]);

  return null;
}
