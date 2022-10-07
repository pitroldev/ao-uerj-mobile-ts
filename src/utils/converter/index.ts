import {Turno} from '@root/types/dateStuff';
import {Class, Schedule, Subject} from '@root/types/generator';
import {
  Horario,
  SubjectClassesSchedule,
} from '@root/types/subjectClassesSchedule';
import {Prereq, SubjectInfo} from '@root/types/subjectInfo';
import {SubjectToTake} from '@root/types/subjectsToTake';
import {
  convertDayToNumber,
  convertTempoHorario,
  strToMinutes,
} from '../horarios';

export function parsePrereq(arr_prereq: Prereq[][]): string[] {
  const codes: string[] = [];
  for (const prereqs of arr_prereq) {
    for (const prereq of prereqs) {
      if (!codes.includes(prereq.id)) {
        codes.push(prereq.id);
      }
    }
  }

  return codes;
}

export function parseSubjectToGeneratorFormat(
  subjectToTake: SubjectToTake,
  subjectInfo: SubjectInfo,
): Subject {
  const subject: Subject = {
    id: subjectInfo.id as string,
    name: subjectInfo.name as string,
    type: subjectToTake.type as string,
    credits: subjectInfo.credits as number,
    prerequisites: parsePrereq(subjectInfo.prerequisite as Prereq[][]),
    allow_conflict: subjectInfo.conflito as boolean,
    recomended_period: subjectToTake.period as number,
    minimum_credits: subjectToTake.minimum_credits,
    total_hours: subjectInfo.workload as number,
  };

  return subject;
}

export function parseScheduleToGeneratorFormat(
  horarios: Horario[],
): Schedule[] {
  const schedules: Schedule[] = [];

  horarios.forEach((horario: Horario) => {
    Object.entries(horario).forEach(([weekDay, time]) => {
      const week_day = convertDayToNumber(weekDay as string);
      time.forEach((turnos: Turno[]) => {
        const first = turnos[0];
        const last = turnos[turnos.length - 1];

        const start_time_in_minutes = strToMinutes(
          convertTempoHorario(first)[0],
        );
        const end_time_in_minutes = strToMinutes(convertTempoHorario(last)[1]);

        schedules.push({
          week_day,
          start_time_in_minutes,
          end_time_in_minutes,
        });
      });
    });
  });

  return schedules;
}

export function parseClassToGeneratorFormat(
  subjectClassSchedule: SubjectClassesSchedule,
  subjectInfo: SubjectInfo,
): Class {
  const class_: Class = {
    id: subjectClassSchedule.classNumber?.toString() as string,
    name: subjectInfo.name as string,
    type: subjectClassSchedule.hasPreference ? 'PREFERRED' : 'REGULAR',
    teachers: subjectClassSchedule.teachers as string[],
    vacancies_amount: subjectClassSchedule.vacancies?.uerj.available as number,
    subject_id: subjectInfo.id as string,
    schedules: parseScheduleToGeneratorFormat(
      subjectClassSchedule.schedule as Horario[],
    ),
    selected_by_user: false,
  };

  return class_;
}
