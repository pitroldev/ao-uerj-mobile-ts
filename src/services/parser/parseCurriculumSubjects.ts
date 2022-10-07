const cheerio = require('react-native-cheerio');

import {CurriculumSubject} from '@root/types/curriculumSubject';

import {
  parseSubjectName,
  parseSubjectID,
  parseSubjectType,
  parseUerjNumber,
} from './minorParser';

export default function parseCurriculumSubjects(
  html: string,
): CurriculumSubject[] {
  try {
    const $ = cheerio.load(html);

    const disciplinas: CurriculumSubject[] = [];
    let disciplinaObj = {} as Partial<CurriculumSubject>;
    $('caption+ tbody td').text((index: number, text: string) => {
      if (index % 6 === 0) {
        disciplinaObj = {};
        disciplinaObj.name = parseSubjectName(text);
        disciplinaObj.id = parseSubjectID(text);
      }
      if ((index - 1) % 6 === 0) {
        disciplinaObj.type = parseSubjectType(
          text,
        ) as CurriculumSubject['type'];
      }
      if ((index - 2) % 6 === 0) {
        disciplinaObj.branch = text.replace('-', '').trim();
      }
      if ((index - 3) % 6 === 0) {
        disciplinaObj.credits = parseUerjNumber(text) || null;
      }
      if ((index - 4) % 6 === 0) {
        disciplinaObj.workload = parseUerjNumber(text) || null;
      }
      if ((index - 5) % 6 === 0) {
        disciplinaObj.period = parseUerjNumber(text) || null;
        disciplinas.push(disciplinaObj as CurriculumSubject);
      }
    });

    return disciplinas;
  } catch (err) {
    throw new Error('ParseError');
  }
}
