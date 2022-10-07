import {SUBJECT_TYPE} from '@root/utils/constants/subjectDictionary';

export interface UniversalSubject {
  name: string;
  id: string;
  allow_conflict: boolean;
  minimum_credits: number | null;
  has_prerequisites: boolean;
  type: keyof typeof SUBJECT_TYPE;
}
