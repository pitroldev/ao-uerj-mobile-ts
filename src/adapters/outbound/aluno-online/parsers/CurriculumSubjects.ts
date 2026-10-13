import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { parseSubjectName, parseSubjectType } from './values';
import { optionalNumber, requireStructure, subjectIdPattern } from './contract';
export function parseCurriculumSubjects($: CheerioAPI): CurriculumSubject[] {
  requireStructure($('.divContentBoxBody table').length > 0);
  requireStructure(/disciplina/i.test($('.divContentBoxBody table').text()));
  const subjects: CurriculumSubject[] = [];
  $('.divContentBoxBody tr').each((_index, row) => {
    const cells = $(row).children('td');
    const subject = cells.eq(0).text().trim();
    const id = subject.match(subjectIdPattern)?.[0];
    if (!id) {
      if (cells.length >= 9 && !cells.filter('[colspan]').length)
        requireStructure(/disciplina/i.test(subject));
      return;
    }
    requireStructure(cells.length >= 9);
    const type = parseSubjectType(cells.eq(3).text());
    requireStructure(
      ['MANDATORY', 'DEFINED', 'UNIVERSAL', 'RESTRICTED'].includes(type),
    );
    subjects.push({
      id,
      name: parseSubjectName(subject),
      period: optionalNumber(cells.eq(1).text()),
      alreadyTaken: cells.eq(2).text().trim() === 'Sim',
      type: type as CurriculumSubject['type'],
      branch: cells.eq(4).text().trim().replace(/^-$/, ''),
      credits: optionalNumber(cells.eq(5).text()),
      workload: optionalNumber(cells.eq(6).text()),
      minimum_credits: optionalNumber(cells.eq(7).text()),
      subjectOfPeriod: cells.eq(8).text().trim() === 'Sim',
    });
  });
  return subjects;
}
