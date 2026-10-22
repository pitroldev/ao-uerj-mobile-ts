import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { parseSubjectName, parseSubjectType } from './values';
import { optionalNumber, requireStructure, subjectIdPattern } from './contract';
/** Fields after the subject cell: credits, workload, type, attendance, grade, status. */
const FIELDS_AFTER_SUBJECT = 6;
/** "2024/2", also with extra text around it ("2024/2 (*)"). */
const PERIOD = /\b(\d{4})[/.](\d)\b/;
function statusOf(text: string): SubjectsTaken['status'] | null {
  if (/preparo/i.test(text)) return 'IN_PROGRESS';
  if (/cancel/i.test(text)) return 'CANCELED';
  if (/aprov/i.test(text)) return 'APPROVED';
  if (/freq/i.test(text)) return 'FAILED_BY_ATTENDANCE';
  if (/nota/i.test(text)) return 'FAILED_BY_GRADE';
  if (/isent/i.test(text)) return 'EXEMPT';
  return null;
}
function parseStatus(text: string): SubjectsTaken['status'] {
  const status = statusOf(text);
  requireStructure(status);
  return status;
}
export function parseSubjectsTaken($: CheerioAPI): SubjectsTaken[] {
  requireStructure(
    $('.divContentBoxBody table, #titulo + table, div table').length > 0,
  );
  requireStructure(/per[ií]odo/i.test($('div table').text()));
  const subjects: SubjectsTaken[] = [];
  let period = '';
  $('div tr').each((_index, row) => {
    const cells = $(row).children('td');
    if (!cells.length) return;
    if (cells.find('table').length) return;
    const texts = cells.map((_cell, cell) => $(cell).text().trim()).get();
    // The subject is the cell with the code, wherever it is in the row: a
    // period cell may come before it, alone or shared with the first subject
    // of the period, or be left empty on the following attempts.
    const at = texts.findIndex(text => subjectIdPattern.test(text));
    if (at < 0) {
      // Summary, complementary activities and headers have no code. A row
      // with the cells and the status of an attempt is a subject whose code
      // was not recognized: fail instead of dropping it from the history.
      requireStructure(
        texts.length < FIELDS_AFTER_SUBJECT + 1 ||
          !statusOf(texts[texts.length - 1]),
      );
      return;
    }
    requireStructure(texts.length - at > FIELDS_AFTER_SUBJECT);
    const lead = texts.slice(0, at).join(' ').trim();
    const periodMatch = lead.match(PERIOD);
    if (periodMatch) period = `${periodMatch[1]}.${periodMatch[2]}`;
    else if (/isent[oa]s?/i.test(lead)) period = 'Isento';
    else requireStructure(!lead);
    const subject = texts[at];
    const id = subject.match(subjectIdPattern)?.[0] as string;
    const field = (index: number) => texts[at + index];
    const status =
      !period || period === 'Isento' ? 'EXEMPT' : parseStatus(field(6));
    subjects.push({
      id,
      name: parseSubjectName(subject),
      period: status === 'EXEMPT' ? 'Isento' : period,
      credits: optionalNumber(field(1)),
      workload: optionalNumber(field(2)),
      type: parseSubjectType(field(3)),
      frequency: optionalNumber(field(4).replace('%', '')),
      grade: optionalNumber(field(5)),
      status,
    });
  });
  return subjects;
}
