const cheerio = require('react-native-cheerio');

import { PartialRID } from './types';

import { parseSubjectName, parseSubjectID } from '@services/parser/minorParser';

export default function parsePartialRID(html: string) {
  const $ = cheerio.load(html);

  const subjects: PartialRID[] = [];

  // Receipt and layout tables share this page with the provisional results.
  $('table.reportTable > tr, table.reportTable > tbody > tr').each(
    (_index: number, row: any) => {
      const cells = $(row).children('td');
      if (cells.length !== 6 || cells.filter('[colspan]').length) {
        return;
      }

      const subject = cells.eq(0).text().trim();
      if (!/\b[A-Z]+\d+-\d+\b/i.test(subject)) {
        return;
      }

      subjects.push({
        id: parseSubjectID(subject),
        name: parseSubjectName(subject),
        classNumber: cells.eq(1).text().trim(),
        available: parseInt(cells.eq(2).text().trim(), 10),
        requested: parseInt(cells.eq(3).text().trim(), 10),
        position: parseInt(cells.eq(4).text().trim(), 10),
        status: cells.eq(5).text().trim(),
      });
    },
  );

  const updatedAt = $('div div:nth-child(1) b').first().text();

  return {
    subjects,
    updatedAt,
  };
}
