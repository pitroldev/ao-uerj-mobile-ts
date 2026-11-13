import {
  CurriculumSubject,
  SubjectInfo,
} from '@root/modules/academics/domain/models';
import type { LunchBreak } from '../domain/lunch';
import {
  GeneratedSchedule,
  Priority,
  Schedule,
  SubjectClasses,
} from '../domain/models';

export type ScheduleGenerationRequest = {
  preferences: {
    minimumSubjects: number;
    maximumSubjects: number;
    priorities: Priority[];
    busyIntervals: Schedule[];
    /** Horário de almoço que toda grade tem de deixar; ausente, sem a regra. */
    lunch?: LunchBreak;
  };
  subjects: Array<{
    curriculum: CurriculumSubject;
    details: SubjectInfo;
    /** Obrigatórias que faltam que ela trava (só com `CRITICAL_FIRST`). */
    criticality?: number;
  }>;
  classes: SubjectClasses[];
};
export type GenerationOptions = { signal?: AbortSignal };
export interface ScheduleGeneratorPort {
  generate(
    request: ScheduleGenerationRequest,
    options?: GenerationOptions,
  ): Promise<GeneratedSchedule[]>;
}
