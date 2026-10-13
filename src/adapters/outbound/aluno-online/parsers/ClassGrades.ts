import type { ClassGrade } from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { parseSubjectName } from './values';
import { optionalNumber, requireStructure, subjectIdPattern } from './contract';
export const parseGrade = optionalNumber;
export function parseClassGrades($: CheerioAPI): ClassGrade[] {
  requireStructure($('table.reportTable').length > 0);
  requireStructure(/disciplina/i.test($('table.reportTable').text()));
  const grades: ClassGrade[] = [];
  $('table.reportTable tr').each((_index, row) => {
    const cells = $(row).children('td');
    const subject = cells.eq(0).text().trim();
    const id = subject.match(subjectIdPattern)?.[0];
    if (!id) {
      if (cells.length >= 6 && !cells.filter('[colspan]').length) {
        requireStructure(/disciplina/i.test(subject));
      }
      return;
    }
    requireStructure(cells.length >= 6);
    grades.push({
      id,
      name: parseSubjectName(subject.replace(id, ''), true),
      class: cells.eq(1).text().trim(),
      grades: {
        p1: parseGrade(cells.eq(2).text()),
        p2: parseGrade(cells.eq(3).text()),
        pf: parseGrade(cells.eq(4).text()),
        result: parseGrade(cells.eq(5).text()),
      },
    });
  });
  return grades;
}
