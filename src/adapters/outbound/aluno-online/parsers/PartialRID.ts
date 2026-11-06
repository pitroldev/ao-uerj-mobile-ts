import { requireStructure, requiredNumber } from './contract';
import type { CheerioAPI } from '../html';

import { PartialRID } from '@root/modules/academics/domain/models';

import { parseSubjectName, parseSubjectID } from './values';

/**
 * As mensagens do portal para "ainda não há RID": fora da inscrição e, desde
 * a atualização de novembro de 2026, antes do primeiro processamento do dia
 * ("ainda não há registro de processamento provisório para visualização ou
 * houve alteração do conjunto de inscrição…").
 */
const NO_RESULT =
  /não há (?:resultado (?:provisório disponível|parcial a ser apresentado)|registro de processamento provisório)/i;

export function parsePartialRID($: CheerioAPI) {
  const hasResultTable = $('table.reportTable').length > 0;
  const pageText = $.root().text().replace(/\s+/g, ' ').trim();
  requireStructure(hasResultTable || NO_RESULT.test(pageText));
  const subjects: PartialRID[] = [];
  if (!hasResultTable) {
    return { subjects, updatedAt: '' };
  }

  // Receipt and layout tables share this page with the provisional results.
  $('table.reportTable > tr, table.reportTable > tbody > tr').each(
    (_index, row) => {
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
        available: requiredNumber(cells.eq(2).text()),
        requested: requiredNumber(cells.eq(3).text()),
        position: requiredNumber(cells.eq(4).text()),
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
