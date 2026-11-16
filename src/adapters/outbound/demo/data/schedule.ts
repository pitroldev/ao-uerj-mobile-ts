/*
 * "Disciplinas em Curso" e o quadro de notas do período corrente, nos
 * formatos de `parseAttendedClassesSchedule` e `parseClassGrades`.
 */
import type {
  AttendedClassesSchedule,
  AttendedSubjectInfo,
  ClassGrade,
} from '@root/modules/academics/domain/models';
import { catalogEntry } from './catalog';
import { ENROLLED, type Enrolled } from './enrolled';
import { scheduleEntry } from './time';

function attendedInfo(subject: Enrolled): AttendedSubjectInfo {
  // como o parser: sem sala virtual, o campo fica ausente
  return {
    id: subject.id,
    name: catalogEntry(subject.id).name,
    class: subject.class,
    status: 'ACTIVE',
    uerjLocation: subject.uerjLocation,
    avaLocation: subject.avaLocation,
  } as AttendedSubjectInfo;
}

/** A grade, em ordem de dia e horário, como o parser devolve. */
export function schedule(): AttendedClassesSchedule[] {
  return ENROLLED.flatMap(subject => {
    const info = attendedInfo(subject);
    return subject.meetings.map(meeting => scheduleEntry(info, meeting));
  }).sort(
    (a, b) =>
      a.dayNumber - b.dayNumber ||
      a.start_time_in_minutes - b.start_time_in_minutes,
  );
}

export function grades(): ClassGrade[] {
  return ENROLLED.map(subject => ({
    id: subject.id,
    name: catalogEntry(subject.id).name,
    class: subject.class,
    grades: { ...subject.grades },
  }));
}
