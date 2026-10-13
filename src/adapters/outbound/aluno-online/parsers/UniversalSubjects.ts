import type { UniversalSubject } from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { parseSubjectName } from './values';
import { optionalNumber, requireStructure, subjectIdPattern } from './contract';
export function parseUniversalSubjects($: CheerioAPI): UniversalSubject[] {
  requireStructure($('.divContentBoxBody table').length > 0);
  requireStructure(/disciplina/i.test($('.divContentBoxBody table').text()));
  const subjects: UniversalSubject[] = [];
  $('.divContentBoxBody tr').each((_index, row) => {
    const cells = $(row).children('td');
    const subject = cells.eq(0).text().trim();
    const id = subject.match(subjectIdPattern)?.[0];
    if (!id) {
      if (cells.length >= 4 && !cells.filter('[colspan]').length)
        requireStructure(/disciplina/i.test(subject));
      return;
    }
    requireStructure(cells.length >= 4);
    subjects.push({
      id,
      name: parseSubjectName(subject),
      type: 'UNIVERSAL',
      credits: optionalNumber(cells.eq(1).text()),
      workload: optionalNumber(cells.eq(2).text()),
      subjectOfPeriod: cells.eq(3).text().trim() === 'Sim',
    });
  });
  return subjects;
}
