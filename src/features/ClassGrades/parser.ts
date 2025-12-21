const cheerio = require('react-native-cheerio');

import { parseSubjectName, parseNumber } from '@services/parser/minorParser';

import { ClassGrade } from './types';

export function parseGrade(strGrade: string) {
  try {
    if (!strGrade) {
      return null;
    }
    return parseFloat(strGrade.trim().replace(',', '.'));
  } catch (e) {
    return null;
  }
}

export default function parseClassGrades(html: string) {
  try {
    console.log('Parsing class grades data...');
    console.log(html);

    const $ = cheerio.load(html);

    const data: ClassGrade[] = [];

    $('table.reportTable tr').each((rowIndex: number, row: any) => {
      if (rowIndex === 0) return;

      const cells = $(row).find('td');
      if (cells.length < 6) return;

      const subjectText = $(cells[0]).text().trim();
      const idMatch = subjectText.match(/^([A-Z]{3}\d{2}-\d{5})\s+(.+)$/);

      const classGrade: ClassGrade = {
        id: idMatch ? idMatch[1] : subjectText,
        name: idMatch
          ? parseSubjectName(idMatch[2], true)
          : parseSubjectName(subjectText, true),
        class: parseNumber($(cells[1]).text()),
        grades: {
          p1: parseGrade($(cells[2]).text()),
          p2: parseGrade($(cells[3]).text()),
          pf: parseGrade($(cells[4]).text()),
          result: parseGrade($(cells[5]).text()),
        },
      };

      data.push(classGrade);
    });

    console.log('Parsed class grades data:', data);

    return data;
  } catch (err) {
    console.log('parser', err);
    throw new Error('ParseError');
  }
}
