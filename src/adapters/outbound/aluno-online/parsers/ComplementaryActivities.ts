import type {
  ComplementaryActivities,
  ComplementaryActivity,
  ComplementaryHoursByType,
} from '@root/modules/academics/domain/models';
import type { CheerioAPI, Element } from '../html';

/** "2023/1", também com texto em volta. */
const PERIOD = /\b(\d{4})[/.](\d)\b/;

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** "60", "60,5" ou "60 h"; outro texto vira `null` (a leitura segue). */
function hoursOf(text: string): number | null {
  const match = clean(text)
    .replace(',', '.')
    .match(/^(\d+(?:\.\d+)?)\s*(?:h|horas)?$/i);
  return match ? Number(match[1]) : null;
}

/**
 * As atividades complementares de "Disciplinas Realizadas", em duas tabelas
 * que só aparecem para quem tem atividades registradas:
 *
 * - "Período | Nome | CH Cumprida | Descrição": uma linha por atividade; o
 *   período fica vazio nas seguintes do mesmo período, e "Nome" é o tipo;
 * - "Resumo por Tipo de Atividade | CH Máxima | CH Cumprida | CH Excedente |
 *   CH Total": cada tipo conta só até o teto (Máxima); o resto é excedente.
 *
 * Sem as tabelas, as listas vêm vazias. As colunas são achadas pelo
 * cabeçalho, não pela posição.
 */
export function parseComplementaryActivities(
  $: CheerioAPI,
): ComplementaryActivities {
  const activities: ComplementaryActivity[] = [];
  const byType: ComplementaryHoursByType[] = [];
  const cellsOf = (row: Element) =>
    $(row)
      .children('th, td')
      .map((_index, cell) => clean($(cell).text()))
      .get();

  $('table').each((_index, table) => {
    // só as tabelas de dados: a de layout tem outras tabelas dentro
    if ($(table).find('table').length) return;
    const rows = $(table).find('tr').toArray();
    if (rows.length < 2) return;
    const header = cellsOf(rows[0]).map(text => text.toLowerCase());
    const column = (pattern: RegExp) =>
      header.findIndex(text => pattern.test(text));

    if (/resumo por tipo de atividade/.test(header[0] ?? '')) {
      const maximum = column(/m[aá]xima/);
      const counted = column(/cumprida/);
      const excess = column(/excedente/);
      const total = column(/total/);
      for (const row of rows.slice(1)) {
        const cells = cellsOf(row);
        if (!cells[0]) continue;
        const at = (index: number) =>
          index < 0 ? null : hoursOf(cells[index] ?? '');
        byType.push({
          type: cells[0],
          maximum: at(maximum),
          counted: at(counted),
          excess: at(excess),
          total: at(total),
        });
      }
      return;
    }

    const hours = column(/ch cumprida/);
    const description = column(/descri/);
    if (hours < 0 || description < 0) return;
    const period = column(/per[ií]odo/);
    const name = column(/^nome$/);
    if (name < 0) return;
    let current: string | null = null;
    for (const row of rows.slice(1)) {
      const cells = cellsOf(row);
      const match = period < 0 ? null : (cells[period] ?? '').match(PERIOD);
      if (match) current = `${match[1]}.${match[2]}`;
      const type = cells[name] ?? '';
      if (!type) continue;
      activities.push({
        period: current,
        type,
        hours: hoursOf(cells[hours] ?? ''),
        description: cells[description] ?? '',
      });
    }
  });

  return { activities, byType };
}
