import {
  CurriculumSubject,
  SubjectInfo,
} from '@root/modules/academics/domain/models';
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
  };
  subjects: Array<{ curriculum: CurriculumSubject; details: SubjectInfo }>;
  classes: SubjectClasses[];
};
export type GenerationOptions = { signal?: AbortSignal };
export interface ScheduleGeneratorPort {
  generate(
    request: ScheduleGenerationRequest,
    options?: GenerationOptions,
  ): Promise<GeneratedSchedule[]>;
}
