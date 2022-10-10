import {SUBJECT_TYPE} from '@root/utils/constants/subjectDictionary';

export interface CurriculumSubject {
  name: string;
  id: string;
  type: keyof typeof SUBJECT_TYPE;
  branch?: string;
  credits: number | null;
  workload: number | null;
  period?: number | null;
}
