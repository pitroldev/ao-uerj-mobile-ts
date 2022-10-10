export type RawSubjectInfo = {
  index: string;
  codeAndName: string;
  class: string;
  avaLocation: string;
  uerjLocationOrStatus: string;
};

export type AttendedSubjectInfo = {
  id: string;
  name: string;
  class: string;
  avaLocation: string;
  uerjLocation: string;
  status: string;
};

export type AttendedClassesSchedule = {
  class: AttendedSubjectInfo;
  dayAlias: string;
  dayNumber: number;
  subject_id: string;
  periodAlias: string;
  startTimeAlias: string;
  endTimeAlias: string;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};
