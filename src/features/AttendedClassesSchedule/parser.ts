const cheerio = require('react-native-cheerio');

import {TIME_VALUES} from '@utils/constants/time';

import {parseSubjectName, parseSubjectID} from '@services/parser/minorParser';

import {
  AttendedSubjectInfo,
  RawSubjectInfo,
  AttendedClassesSchedule,
} from './types';

function getSubjectsInfo(html: string) {
  const $ = cheerio.load(html);

  const rawSubjects: Partial<RawSubjectInfo>[] = [];

  const header = [
    'index',
    'codeAndName',
    'class',
    'avaLocation',
    'uerjLocationOrStatus',
  ];

  $('.divContentBoxBody div:nth-child(1) table tr').each(
    (rowIndex: number, row: any) => {
      const isHeader = rowIndex === 0;
      const hasEnoughChildrens = row.children?.length > 5;
      if (isHeader || !hasEnoughChildrens) {
        return;
      }

      const subjectRawInfo = {};
      $(row)
        .find('td')
        .each((colIndex: number, cell: any) => {
          const cellValue = cell?.children && cell.children[0]?.data;
          Object.assign(subjectRawInfo, {[header[colIndex]]: cellValue});
        });

      const hasAnyValue = Object.values(subjectRawInfo).some(Boolean);
      if (hasAnyValue) {
        rawSubjects.push(subjectRawInfo as RawSubjectInfo);
      }
    },
  );

  const subjects: AttendedSubjectInfo[] = rawSubjects.map(rawSubject => {
    const {codeAndName, uerjLocationOrStatus} = rawSubject;
    const id = parseSubjectID(codeAndName as string);
    const name = parseSubjectName(codeAndName as string);
    const status = uerjLocationOrStatus?.toLowerCase().includes('cancelada')
      ? 'CANCELED'
      : 'ACTIVE';

    const avaLocation = rawSubject.avaLocation?.trim() || undefined;
    const uerjLocation =
      status === 'CANCELED' ? undefined : uerjLocationOrStatus?.trim();

    delete rawSubject.index;
    delete rawSubject.codeAndName;
    delete rawSubject.uerjLocationOrStatus;

    return {
      ...rawSubject,
      id,
      name,
      status,
      uerjLocation,
      avaLocation,
    } as AttendedSubjectInfo;
  });

  return subjects;
}

type ScheduleInfo = {
  dayAlias: string;
  dayNumber: number;
  subject_id: string;
  periodAlias: string;
  startTimeAlias: string;
  endTimeAlias: string;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

function getFragmentedSchedule(html: string) {
  const header = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const $ = cheerio.load(html);

  const fragmentedSchedule: ScheduleInfo[] = [];
  let begin = false;
  $('.divContentBoxBody div+ div table tr').each(
    (rowIndex: number, row: any) => {
      const hasId = row.attribs.id;
      if (hasId) {
        begin = true;
      }

      if (!begin) {
        return;
      }

      const timeIndex = Math.ceil(rowIndex / 2) - 1;
      const rowTime = TIME_VALUES[timeIndex];

      $(row)
        .find('td')
        .each((dayNumber: number, cell: any) => {
          const dayAlias = header[dayNumber];
          const cellValue: string = cell?.children && cell.children[0]?.data;

          const nonUniqueSubjectsCode =
            cellValue?.split('\n')?.map(c => c.trim()) ?? [];
          const subjectsCode = [...new Set(nonUniqueSubjectsCode)];

          subjectsCode.forEach(subject_id => {
            const currentSchedule: Partial<ScheduleInfo> = {};

            Object.assign(currentSchedule, {
              dayAlias,
              dayNumber: dayNumber + 1,
              subject_id,
              ...rowTime,
            });
            const hasAnyValue =
              Object.values(currentSchedule).some(Boolean) &&
              currentSchedule.subject_id;

            if (hasAnyValue) {
              fragmentedSchedule.push(currentSchedule as ScheduleInfo);
            }
          });
        });
    },
  );

  return fragmentedSchedule;
}

function mergeFragmentedSchedule(fragmentedSchedule: ScheduleInfo[]) {
  const MAX_GAP_IN_MINUTES = 15;

  const mergedSchedule = fragmentedSchedule.reduce((acc, current) => {
    const {subject_id, dayAlias, start_time_in_minutes, end_time_in_minutes} =
      current;
    const classRightBefore = acc.find(
      c =>
        c.dayAlias === dayAlias &&
        c.subject_id === subject_id &&
        c.end_time_in_minutes - start_time_in_minutes <= MAX_GAP_IN_MINUTES,
    );

    if (!classRightBefore) {
      acc.push(current);
      return acc;
    }

    Object.assign(classRightBefore, {end_time_in_minutes});
    return acc;
  }, [] as ScheduleInfo[]);

  return mergedSchedule;
}

function populateScheduleWithClassInfo(
  schedule: ScheduleInfo[],
  subjects: AttendedSubjectInfo[],
) {
  return schedule.map(c => ({
    ...c,
    class: subjects.find(s => s.id === c.subject_id) as AttendedSubjectInfo,
  }));
}

export default function parseAttendedClassesSchedule(
  html: string,
): AttendedClassesSchedule[] {
  try {
    const subjects = getSubjectsInfo(html);
    const fragmentedSchedule = getFragmentedSchedule(html);
    const mergedSchedule = mergeFragmentedSchedule(fragmentedSchedule);

    const populatedSchedule = populateScheduleWithClassInfo(
      mergedSchedule,
      subjects,
    );

    const sortedSchedule = populatedSchedule.sort(
      (a, b) =>
        a.dayNumber * 10000 +
        a.start_time_in_minutes -
        (b.dayNumber * 10000 + b.start_time_in_minutes),
    );
    return sortedSchedule;
  } catch (err) {
    throw err;
  }
}
