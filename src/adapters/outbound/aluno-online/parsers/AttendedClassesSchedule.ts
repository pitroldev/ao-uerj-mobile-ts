import {
  requireStructure,
  assertFiniteValues,
  subjectIdPattern,
} from './contract';
import type { CheerioAPI } from '../html';

import { TIME_VALUES } from '@utils/constants/time';

import { parseSubjectName, parseSubjectID } from './values';

import {
  AttendedSubjectInfo,
  RawSubjectInfo,
  AttendedClassesSchedule,
} from '@root/modules/academics/domain/models';

/**
 * As tabelas da página, achadas pelo conteúdo: as das disciplinas pelo
 * cabeçalho ("Disciplina" e "Turma") e a grade pela linha com `id` onde os
 * horários começam. A página de novembro de 2026 põe um aviso ("Não constam
 * disciplinas inscritas ou canceladas.") antes delas, e um aviso desses
 * desloca as posições que os seletores antigos usavam; sem achar pelo
 * conteúdo, ficam os de sempre. Todas as tabelas de disciplinas valem (as
 * inscritas e as canceladas podem vir separadas): uma disciplina que ficasse
 * de fora deixaria o código dela na grade sem dono.
 */
function subjectRows($: CheerioAPI) {
  const tables = $('.divContentBoxBody table').filter((_index, element) => {
    const first = $(element).find('tr').first().text();
    return (
      /disciplina/i.test(first) &&
      /turma/i.test(first) &&
      $(element).find('tr[id]').length === 0
    );
  });
  if (!tables.length) return $('.divContentBoxBody div:nth-child(1) table tr');
  return tables.find('tr').filter(
    // o cabeçalho de cada tabela sai aqui; as linhas sem código, adiante
    (_index, row) => $(row).children('th').length === 0,
  );
}

/**
 * Os códigos de uma célula da grade, na ordem e sem repetir. Duas disciplinas
 * no mesmo tempo podem vir separadas por quebra de linha ou só por um `<br>`,
 * que o texto da célula junta ("ABC01-12345DEF02-67890").
 */
const GRID_CODE = /[A-Z]+\d+-\d+/gi;
const gridCodes = (cell: string) => [
  ...new Set((cell.match(GRID_CODE) ?? []).map(code => code.toUpperCase())),
];

const minutes = (hours: string, mins: string) =>
  Number(hours) * 60 + Number(mins);

/**
 * O tempo pelo rótulo da linha ("M1 (07:00 - 07:50)"): um tempo conhecido
 * fica com os horários de sempre; um que o app não conhece, com os do rótulo.
 * Sem rótulo, vale a posição da linha.
 */
function slotTime(label: string, position: number) {
  const alias = /\b([MTN]\d)\b/.exec(label)?.[1];
  const known = TIME_VALUES.find(time => time.periodAlias === alias);
  if (known) return known;
  const range = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(label);
  if (alias && range) {
    const [, startH, startM, endH, endM] = range;
    return {
      periodAlias: alias,
      startTimeAlias: `${Number(startH)}:${startM}`,
      endTimeAlias: `${Number(endH)}:${endM}`,
      start_time_in_minutes: minutes(startH, startM),
      end_time_in_minutes: minutes(endH, endM),
    };
  }
  return TIME_VALUES[position];
}

function gridRows($: CheerioAPI) {
  const table = $('.divContentBoxBody table')
    .filter((_index, element) => $(element).find('tr[id]').length > 0)
    .first();
  return table.length
    ? table.find('tr')
    : $('.divContentBoxBody div+ div table tr');
}

function getSubjectsInfo($: CheerioAPI) {
  const rawSubjects: Partial<RawSubjectInfo>[] = [];

  const header = [
    'index',
    'codeAndName',
    'class',
    'avaLocation',
    'uerjLocationOrStatus',
  ];

  subjectRows($).each((_rowIndex, row) => {
    // a linha de uma disciplina tem o código na 2ª célula; sem o "Local de
    // Aula" (ou com as últimas células juntas), ela ainda vale
    const tds = $(row).children('td');
    const hasSubject =
      tds.length >= 3 && subjectIdPattern.test(tds.eq(1).text());
    if (!hasSubject) {
      return;
    }

    const subjectRawInfo = {};
    $(row)
      .find('td')
      .each((colIndex, cell) => {
        const cellValue = $(cell).text().trim();
        Object.assign(subjectRawInfo, { [header[colIndex]]: cellValue });
      });

    const hasAnyValue = Object.values(subjectRawInfo).some(Boolean);
    if (hasAnyValue) {
      rawSubjects.push(subjectRawInfo);
    }
  });

  const subjects: AttendedSubjectInfo[] = rawSubjects.map(rawSubject => {
    const { codeAndName, uerjLocationOrStatus } = rawSubject;
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

function getFragmentedSchedule($: CheerioAPI) {
  const header = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  const fragmentedSchedule: ScheduleInfo[] = [];
  let begin = false;
  gridRows($).each((rowIndex, row) => {
    const hasId = row.attribs.id;
    if (hasId) {
      begin = true;
    }

    if (!begin) {
      return;
    }

    const rowTime = slotTime(
      $(row).children('th').first().text(),
      Math.ceil(rowIndex / 2) - 1,
    );

    $(row)
      .find('td')
      .each((dayNumber, cell) => {
        const dayAlias = header[dayNumber];

        gridCodes($(cell).text()).forEach(subject_id => {
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
  });

  return fragmentedSchedule;
}

function mergeFragmentedSchedule(fragmentedSchedule: ScheduleInfo[]) {
  const MAX_GAP_IN_MINUTES = 15;

  const mergedSchedule = fragmentedSchedule.reduce((acc, current) => {
    const { subject_id, dayAlias, start_time_in_minutes, end_time_in_minutes } =
      current;
    const classRightBefore = acc.find(
      c =>
        c.dayAlias === dayAlias &&
        c.subject_id === subject_id &&
        start_time_in_minutes >= c.end_time_in_minutes &&
        start_time_in_minutes - c.end_time_in_minutes <= MAX_GAP_IN_MINUTES,
    );

    if (!classRightBefore) {
      acc.push(current);
      return acc;
    }

    Object.assign(classRightBefore, {
      end_time_in_minutes,
      endTimeAlias: current.endTimeAlias,
    });
    return acc;
  }, [] as ScheduleInfo[]);

  return mergedSchedule;
}

/**
 * Cada tempo com a disciplina da tabela. Um código da grade sem linha na
 * tabela sai sozinho, sem derrubar a grade: o aluno continua vendo as outras
 * aulas. Se nenhum código achar a disciplina, a página mudou.
 */
function populateScheduleWithClassInfo(
  schedule: ScheduleInfo[],
  subjects: AttendedSubjectInfo[],
): AttendedClassesSchedule[] {
  const populated = schedule.flatMap(item => {
    const subject = subjects.find(s => s.id.toUpperCase() === item.subject_id);
    return subject ? [{ ...item, subject_id: subject.id, class: subject }] : [];
  });
  requireStructure(schedule.length === 0 || populated.length > 0);
  return populated;
}

/**
 * Disciplina em curso sem horário na grade (estágio, TCC, EAD): um item sem
 * dia nem horário, para ela continuar no app. A linha do tempo, a próxima
 * aula, o widget e os lembretes só usam aulas com horário.
 */
function untimedClass(subject: AttendedSubjectInfo): AttendedClassesSchedule {
  return {
    class: subject,
    dayAlias: '',
    dayNumber: 0,
    subject_id: subject.id,
    periodAlias: '',
    startTimeAlias: '',
    endTimeAlias: '',
    start_time_in_minutes: -1,
    end_time_in_minutes: -1,
  };
}

export function parseAttendedClassesSchedule(
  $: CheerioAPI,
): AttendedClassesSchedule[] {
  requireStructure($('.divContentBoxBody table').length > 0);
  const subjects = getSubjectsInfo($);
  const fragmentedSchedule = getFragmentedSchedule($);
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
  sortedSchedule.forEach(item => {
    requireStructure(item.class && item.startTimeAlias && item.endTimeAlias);
  });
  // as que não estão na grade vêm depois, sem horário (não somem do app)
  const untimed = subjects
    .filter(subject => !sortedSchedule.some(item => item.class === subject))
    .map(untimedClass);
  const schedule = [...sortedSchedule, ...untimed];
  assertFiniteValues(schedule);
  return schedule;
}
