import parseSubjectInfo from './parseSubjectInfo';
import parseCurriculumSubjects from './parseCurriculumSubjects';
import parseSubjectsToTake from './parseSubjectsToTake';
import parseAttendedSubjects from './parseAttendedSubjects';
import parseUniversalSubjects from './parseUniversalSubjects';
import parseClassesScheduleByUnit from './parseClassesScheduleByUnit';
import notasParciais from './notasParciais';
import ridProvisorio from './ridProvisorio';
import parseSubjectClassesSchedule from './parseSubjectClassesSchedule';
import * as minorParser from './minorParser';

export {
  parseSubjectInfo,
  parseCurriculumSubjects,
  parseSubjectsToTake,
  parseAttendedSubjects,
  parseUniversalSubjects,
  parseClassesScheduleByUnit,
  notasParciais,
  ridProvisorio,
  parseSubjectClassesSchedule,
};

export default {
  parseSubjectInfo,
  parseCurriculumSubjects,
  parseSubjectsToTake,
  parseAttendedSubjects,
  parseUniversalSubjects,
  parseClassesScheduleByUnit,
  notasParciais,
  ridProvisorio,
  parseSubjectClassesSchedule,
  ...minorParser,
};
