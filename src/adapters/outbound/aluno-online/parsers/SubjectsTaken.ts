import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { parseSubjectName, parseSubjectType } from './values';
import { optionalNumber, requireStructure, subjectIdPattern } from './contract';
const cheerio = require('react-native-cheerio');
function parseStatus(text: string): SubjectsTaken['status'] {
  if (/preparo/i.test(text)) return 'IN_PROGRESS';
  if (/cancel/i.test(text)) return 'CANCELED';
  if (/aprov/i.test(text)) return 'APPROVED';
  if (/freq/i.test(text)) return 'FAILED_BY_ATTENDANCE';
  if (/nota/i.test(text)) return 'FAILED_BY_GRADE';
  if (/isent/i.test(text)) return 'EXEMPT';
  requireStructure(false);
}
export default function parseSubjectsTaken(html: string): SubjectsTaken[] {
  const $ = cheerio.load(html);
  requireStructure(
    $('.divContentBoxBody table, #titulo + table, div table').length > 0,
  );
  requireStructure(/per[ií]odo/i.test($('div table').text()));
  const subjects: SubjectsTaken[] = [];
  let period = '';
  $('div tr').each((_index: number, row: any) => {
    const cells = $(row).children('td');
    if (!cells.length) return;
    if (cells.find('table').length) return;
    // A period cell may share a row with the first subject; headers and
    // exemption rows do not have the fixed number of cells of a subject.
    let offset = 0;
    const first = cells.eq(0).text().trim();
    const periodMatch = first.match(/^\d{4}[/.]\d$/);
    if (periodMatch) {
      period = periodMatch[0].replace('/', '.');
      offset = 1;
    } else if (/^isent[oa]s?$/i.test(first)) {
      period = 'Isento';
      offset = 1;
    } else if (!first && subjectIdPattern.test(cells.eq(1).text())) {
      // The portal repeats an empty period cell on subsequent attempts.
      offset = 1;
    }
    const subject = cells.eq(offset).text().trim();
    const id = subject.match(subjectIdPattern)?.[0];
    if (!id) return;
    requireStructure(cells.length - offset >= 7);
    const statusText = cells
      .eq(offset + 6)
      .text()
      .trim();
    const status =
      !period || period === 'Isento' ? 'EXEMPT' : parseStatus(statusText);
    subjects.push({
      id,
      name: parseSubjectName(subject),
      period: status === 'EXEMPT' ? 'Isento' : period,
      credits: optionalNumber(cells.eq(offset + 1).text()),
      workload: optionalNumber(cells.eq(offset + 2).text()),
      type: parseSubjectType(cells.eq(offset + 3).text()),
      frequency: optionalNumber(
        cells
          .eq(offset + 4)
          .text()
          .replace('%', ''),
      ),
      grade: optionalNumber(cells.eq(offset + 5).text()),
      status,
    });
  });
  return subjects;
}
