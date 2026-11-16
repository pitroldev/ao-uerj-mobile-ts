import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import type { DemoClock } from '../clock';
import { UNIVERSALS, subjectDetails } from '../data/catalog';
import { enrollmentResult, partialRid } from '../data/enrollment';
import { curriculum, history } from '../data/history';
import { grades, schedule } from '../data/schedule';
import { complementaryActivities, synthesis } from '../data/synthesis';

/** As leituras do Aluno Online, respondidas com o aluno fictício. */
export function createDemoRecords(clock: DemoClock): AcademicRecordsPort {
  return {
    getGrades: options => clock.respond(grades, options?.signal),
    getHistory: options => clock.respond(() => history(clock), options?.signal),
    getComplementaryActivities: options =>
      clock.respond(() => complementaryActivities(clock), options?.signal),
    getCurriculum: options => clock.respond(curriculum, options?.signal),
    getSchedule: options => clock.respond(schedule, options?.signal),
    getPartialRid: options =>
      clock.respond(() => partialRid(clock), options?.signal),
    getEnrollmentResult: options =>
      clock.respond(enrollmentResult, options?.signal),
    getSubjectDetails: (subjectId, options) =>
      clock.respond(() => {
        const details = subjectDetails(subjectId);
        // o portal responde um código desconhecido com uma página que o
        // parser recusa
        if (!details) throw new AppError('PORTAL_LAYOUT_CHANGED');
        return details;
      }, options?.signal),
    getUniversalSubjects: options =>
      clock.respond(() => UNIVERSALS, options?.signal),
    getSynthesis: options =>
      clock.respond(() => synthesis(clock), options?.signal),
  };
}
