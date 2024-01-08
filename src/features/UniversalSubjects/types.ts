export type DepartmentOptions = {
  value: string;
  text: string;
  selected: boolean;
};

export interface UniversalSubject {
  id: string;
  name: string;
  type: 'UNIVERSAL';
  credits: number | null;
  workload: number | null;
  subjectOfPeriod?: boolean;
}
