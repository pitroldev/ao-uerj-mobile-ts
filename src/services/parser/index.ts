import parseSubjectInfo from './parseSubjectInfo';
import parseCurriculumSubjects from './parseCurriculumSubjects';
import parseSubjectsToTake from './parseSubjectsToTake';
import parseAttendedSubjects from './parseAttendedSubjects';
import parseUniversalSubjects from './parseUniversalSubjects';
import parseClassesScheduleByUnit from './parseClassesScheduleByUnit';
import parseClassGrades from './classGrades';
import parsePartialRID from './partialRID';
import parseSubjectClassesSchedule from './parseSubjectClassesSchedule';
import * as minorParser from './minorParser';

export {
  parseSubjectInfo,
  parseCurriculumSubjects,
  parseSubjectsToTake,
  parseAttendedSubjects,
  parseUniversalSubjects,
  parseClassesScheduleByUnit,
  parseClassGrades,
  parsePartialRID,
  parseSubjectClassesSchedule,
};

export default {
  parseSubjectInfo,
  parseCurriculumSubjects,
  parseSubjectsToTake,
  parseAttendedSubjects,
  parseUniversalSubjects,
  parseClassesScheduleByUnit,
  parseClassGrades,
  parsePartialRID,
  parseSubjectClassesSchedule,
  ...minorParser,
};
