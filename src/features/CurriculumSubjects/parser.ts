const cheerio = require('react-native-cheerio');

import {
  parseSubjectName,
  parseSubjectID,
  parseSubjectType,
  parseUerjNumber,
} from '@services/parser/minorParser';

import { CurriculumSubject } from './types';

const TABLE_COLUMN_INDEX_MAP = {
  0: 'NAME_AND_ID',
  1: 'PERIOD',
  2: 'ALREADY_TAKEN',
  3: 'TYPE',
  4: 'BRANCH',
  5: 'CREDITS',
  6: 'WORKLOAD',
  7: 'MINIMUM_CREDITS',
  8: 'SUBJECT_OF_PERIOD',
} as const;

type TableKey = keyof typeof TABLE_COLUMN_INDEX_MAP;

export default function parseCurriculumSubjects(
  html: string,
): CurriculumSubject[] {
  try {
    const $ = cheerio.load(html);

    const disciplinas: CurriculumSubject[] = [];
    $('.divContentBoxBody tr').each((rowIndex: number, rowElement: any) => {
      const isHeader = rowIndex === 0;
      if (isHeader) {
        return;
      }

      const disciplinaObj = {} as Partial<CurriculumSubject>;
      $(rowElement)
        .find('td')
        .each((columnIndex: number, columnElement: any) => {
          const isOutOfBound = columnIndex > 8;
          if (isOutOfBound) {
            return;
          }

          const text = $(columnElement).text().trim();

          const columnName = TABLE_COLUMN_INDEX_MAP[columnIndex as TableKey];

          if (columnName === 'NAME_AND_ID') {
            disciplinaObj.id = parseSubjectID(text);
            disciplinaObj.name = parseSubjectName(text);
          }

          if (columnName === 'PERIOD') {
            disciplinaObj.period = parseUerjNumber(text) || null;
          }

          if (columnName === 'ALREADY_TAKEN') {
            disciplinaObj.alreadyTaken = text === 'Sim';
          }

          if (columnName === 'TYPE') {
            disciplinaObj.type = parseSubjectType(
              text,
            ) as CurriculumSubject['type'];
          }

          if (columnName === 'BRANCH') {
            disciplinaObj.branch = text.replace('-', '').trim();
          }

          if (columnName === 'CREDITS') {
            disciplinaObj.credits = parseUerjNumber(text) || null;
          }

          if (columnName === 'WORKLOAD') {
            disciplinaObj.workload = parseUerjNumber(text) || null;
          }

          if (columnName === 'MINIMUM_CREDITS') {
            disciplinaObj.minimum_credits = parseUerjNumber(text) || null;
          }

          if (columnName === 'SUBJECT_OF_PERIOD') {
            disciplinaObj.subjectOfPeriod = text === 'Sim';
          }
        });

      disciplinas.push(disciplinaObj as CurriculumSubject);
    });

    return disciplinas;
  } catch (err) {
    console.log('Error parsing curriculum subjects', err);
    throw new Error('ParseError');
  }
}
