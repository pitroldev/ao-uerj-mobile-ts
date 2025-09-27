import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';

export interface CurriculumSubject {
  id: string;
  name: string;
  period?: number | null;
  alreadyTaken?: boolean;
  type: keyof typeof SUBJECT_TYPE;
  branch?: string;
  credits: number | null;
  workload: number | null;
  minimum_credits: number | null;
  subjectOfPeriod?: boolean;
}
