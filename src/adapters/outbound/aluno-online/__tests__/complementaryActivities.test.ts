import { loadHtml } from '../html';
import { parseComplementaryActivities } from '../parsers/ComplementaryActivities';
import { parseSubjectsTaken } from '../parsers/SubjectsTaken';
import { historyPage, historyRow } from '../__fixtures__/historyPage';

const parse = (html: string) => parseComplementaryActivities(loadHtml(html));
const row = historyRow('2024/2', 'ABC01-00103', 'Aprov. Nota', '8,0');

it('reads the activities, carrying the period to the following rows', () => {
  expect(parse(historyPage(row)).activities).toEqual([
    {
      period: '2023.1',
      type: 'Participação em cursos de extensão',
      hours: 30,
      description: 'Oficina de teste',
    },
    {
      period: '2023.1',
      type: 'Assistir palestras e aulas inaugurais',
      hours: 4,
      description: '',
    },
    {
      period: '2024.2',
      type: 'Participação em cursos de extensão',
      hours: 40,
      description: 'Curso de teste',
    },
  ]);
});

it('reads the summary per activity type, with the cap and the excess', () => {
  expect(parse(historyPage(row)).byType).toEqual([
    {
      type: 'Participação em cursos de extensão',
      maximum: 60,
      counted: 60,
      excess: 10,
      total: 70,
    },
    {
      type: 'Assistir palestras e aulas inaugurais',
      maximum: 20,
      counted: 4,
      excess: 0,
      total: 4,
    },
  ]);
});

it('finds the columns by header and keeps going on odd hour cells', () => {
  const tables = `
      <table><tr><th>Descrição</th><th>CH Cumprida</th><th>Nome</th><th>Período</th></tr>
        <tr><td>Mostra</td><td>12 h</td><td>Monitoria</td><td>2025/1</td></tr>
        <tr><td></td><td>a confirmar</td><td>Monitoria</td><td></td></tr>
      </table>`;
  expect(parse(historyPage(row, tables))).toEqual({
    activities: [
      { period: '2025.1', type: 'Monitoria', hours: 12, description: 'Mostra' },
      { period: '2025.1', type: 'Monitoria', hours: null, description: '' },
    ],
    byType: [],
  });
});

it('returns empty lists for a student without activities on record', () => {
  expect(parse(historyPage(row, ''))).toEqual({ activities: [], byType: [] });
});

it('leaves the subjects of the history untouched by the activity tables', () => {
  expect(parseSubjectsTaken(loadHtml(historyPage(row)))).toHaveLength(1);
});
