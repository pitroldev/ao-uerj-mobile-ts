import { AcademicRecordsPort, AcademicRequestOptions } from '../ports';
import { normalizeSubjectId } from '../../domain/rules/subjectId';

export class ReadAcademicRecords {
  constructor(private readonly records: AcademicRecordsPort) {}

  grades = (options?: AcademicRequestOptions) =>
    this.records.getGrades(options);
  history = (options?: AcademicRequestOptions) =>
    this.records.getHistory(options);
  complementaryActivities = (options?: AcademicRequestOptions) =>
    this.records.getComplementaryActivities(options);
  curriculum = (options?: AcademicRequestOptions) =>
    this.records.getCurriculum(options);
  schedule = (options?: AcademicRequestOptions) =>
    this.records.getSchedule(options);
  partialRid = (options?: AcademicRequestOptions) =>
    this.records.getPartialRid(options);
  universalSubjects = (options?: AcademicRequestOptions) =>
    this.records.getUniversalSubjects(options);
  synthesis = (options?: AcademicRequestOptions) =>
    this.records.getSynthesis(options);
  subjectDetails = (subjectId: string, options?: AcademicRequestOptions) =>
    this.records.getSubjectDetails(normalizeSubjectId(subjectId), options);
}
