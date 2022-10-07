export {default} from './UerjApi';

import {retry} from './utils';

import {getAttendedClassesSchedule as _getAttendedClassesSchedule} from './lib/attendedClassesSchedule';
import {getAttendedSubjects as _getAttendedSubjects} from './lib/attendedSubjects';
import {getClassesScheduleByUnit as _getClassesScheduleByUnit} from './lib/classesScheduleByUnit';
import {getClassGrades as _getClassGrades} from './lib/classGrades';
import {getCurriculumSubjects as _getCurriculumSubjects} from './lib/curriculumSubjects';
import {handleLogin as _handleLogin} from './lib/login';
import {getPartialRID as _getPartialRID} from './lib/partialRID';
import {refreshAuth as _refreshAuth} from './lib/refreshAuth';
import {getSubjectClassesSchedule as _getSubjectClassesSchedule} from './lib/subjectClassesSchedule';
import {getSubjectInfo as _getSubjectInfo} from './lib/subjectInfo';
import {getSubjectsToTake as _getSubjectsToTake} from './lib/subjectsToTake';
import {getUniversalSubjects as _getUniversalSubjects} from './lib/universalSubjects';

const methods = {
  _refreshAuth,
  _handleLogin,
  _getAttendedClassesSchedule,
  _getClassGrades,
  _getPartialRID,
  _getCurriculumSubjects,
  _getSubjectsToTake,
  _getAttendedSubjects,
  _getUniversalSubjects,
  _getClassesScheduleByUnit,
  _getSubjectInfo,
  _getSubjectClassesSchedule,
};

const methodsWithRetry = Object.entries(methods)
  .map(([name, func]) => [
    name,
    async (...params: Parameters<typeof func>) =>
      retry<ReturnType<typeof func>>(func, params),
  ])
  .reduce((acc, [name, func]) => {
    Object.assign(acc, {[name as string]: func});
    return acc;
  }, {} as typeof methods);

export const {
  _refreshAuth: refreshAuth,
  _handleLogin: handleLogin,
  _getAttendedClassesSchedule: getAttendedClassesSchedule,
  _getClassGrades: getClassGrades,
  _getPartialRID: getPartialRID,
  _getCurriculumSubjects: getCurriculumSubjects,
  _getSubjectsToTake: getSubjectsToTake,
  _getAttendedSubjects: getAttendedSubjects,
  _getUniversalSubjects: getUniversalSubjects,
  _getClassesScheduleByUnit: getClassesScheduleByUnit,
  _getSubjectInfo: getSubjectInfo,
  _getSubjectClassesSchedule: getSubjectClassesSchedule,
} = methodsWithRetry;
