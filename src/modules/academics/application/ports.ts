import type {
  AttendedClassesSchedule,
  ClassGrade,
  CurriculumSubject,
  PartialRidResult,
  SubjectInfo,
  SubjectsTaken,
  UniversalSubject,
} from '../domain/models';

export type AcademicRequestOptions = { signal?: AbortSignal };

export interface AcademicRecordsPort {
  getGrades(options?: AcademicRequestOptions): Promise<ClassGrade[]>;
  getHistory(options?: AcademicRequestOptions): Promise<SubjectsTaken[]>;
  getCurriculum(options?: AcademicRequestOptions): Promise<CurriculumSubject[]>;
  getSchedule(
    options?: AcademicRequestOptions,
  ): Promise<AttendedClassesSchedule[]>;
  getPartialRid(options?: AcademicRequestOptions): Promise<PartialRidResult>;
  getSubjectDetails(
    subjectId: string,
    options?: AcademicRequestOptions,
  ): Promise<SubjectInfo>;
  getUniversalSubjects(
    options?: AcademicRequestOptions,
  ): Promise<UniversalSubject[]>;
}
