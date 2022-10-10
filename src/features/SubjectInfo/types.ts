export interface Prereq {
  name: string;
  id: string;
}

export interface SubjectInfo {
  id?: string;
  name?: string;
  credits?: number;
  workload?: number;
  timesPerWeek?: number;
  universal?: boolean;
  conflito?: boolean;
  preparo?: boolean;
  approvation_type?: string;
  duration?: string;
  prerequisite?: Array<Prereq[]>;
}
