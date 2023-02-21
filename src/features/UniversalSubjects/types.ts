import {SUBJECT_TYPE} from '@utils/constants/subjectDictionary';

export type DepartmentOptions = {
  value: string;
  text: string;
  selected: boolean;
};

export interface UniversalSubject {
  name: string;
  id: string;
  allow_conflict: boolean;
  minimum_credits: number | null;
  has_prerequisites: boolean;
  type: keyof typeof SUBJECT_TYPE;
}
