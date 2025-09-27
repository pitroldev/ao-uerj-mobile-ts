import { UniversalSubject } from '@features/UniversalSubjects/types';

const cheerio = require('react-native-cheerio');

import {
  parseSubjectName,
  parseSubjectID,
  parseUerjNumber,
} from '@services/parser/minorParser';

const TABLE_COLUMN_INDEX_MAP = {
  0: 'NAME_AND_ID',
  1: 'CREDITS',
  2: 'WORKLOAD',
  3: 'SUBJECT_OF_PERIOD',
} as const;

type TableKey = keyof typeof TABLE_COLUMN_INDEX_MAP;

export default function parseUniversalSubjects(html: string) {
  try {
    const $ = cheerio.load(html);

    const universalSubjects: UniversalSubject[] = [];

    $('.divContentBoxBody tr').each((rowIndex: number, rowElement: any) => {
      const isHeader = rowIndex === 0;
      if (isHeader) {
        return;
      }

      const disciplinaObj = {} as Partial<UniversalSubject>;
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

          if (columnName === 'CREDITS') {
            disciplinaObj.credits = parseUerjNumber(text) || null;
          }

          if (columnName === 'WORKLOAD') {
            disciplinaObj.workload = parseUerjNumber(text) || null;
          }

          if (columnName === 'SUBJECT_OF_PERIOD') {
            disciplinaObj.subjectOfPeriod = text === 'Sim';
          }
        });

      universalSubjects.push(disciplinaObj as UniversalSubject);
    });

    return universalSubjects;
  } catch (err) {
    throw new Error('ParseError');
  }
}
