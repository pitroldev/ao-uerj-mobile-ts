import type {
  AttendedClassesSchedule,
  ClassGrade,
  CurriculumSubject,
  EnrollmentResult,
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
  /** Resultado final da inscrição (aceitas e não aceitas, com o motivo). */
  getEnrollmentResult(
    options?: AcademicRequestOptions,
  ): Promise<EnrollmentResult>;
  getSubjectDetails(
    subjectId: string,
    options?: AcademicRequestOptions,
  ): Promise<SubjectInfo>;
  getUniversalSubjects(
    options?: AcademicRequestOptions,
  ): Promise<UniversalSubject[]>;
}
