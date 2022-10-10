const cheerio = require('react-native-cheerio');

import {parseSubjectName, parseNumber} from '@services/parser/minorParser';

import {ClassGrade} from './types';

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
    const $ = cheerio.load(html);

    const data: ClassGrade[] = [];
    let classGrade = {grades: {}} as ClassGrade;

    $('font td font').text((index: number, text: string) => {
      if (index % 7 === 0) {
        classGrade.id = text.trim();
        return;
      }

      if ((index - 1) % 7 === 0) {
        classGrade.name = parseSubjectName(text.trim(), true);
        return;
      }
      if ((index - 2) % 7 === 0) {
        classGrade.class = parseNumber(text);
      }
      if ((index - 3) % 7 === 0) {
        classGrade.grades.p1 = parseGrade(text);
      }
      if ((index - 4) % 7 === 0) {
        classGrade.grades.p2 = parseGrade(text);
      }
      if ((index - 5) % 7 === 0) {
        classGrade.grades.pf = parseGrade(text);
      }
      if ((index - 6) % 7 === 0) {
        classGrade.grades.result = parseGrade(text);
        data.push(classGrade);
        classGrade = {grades: {}} as ClassGrade;
      }
    });

    return data;
  } catch (err) {
    throw new Error('ParseError');
  }
}
