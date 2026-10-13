import { loadHtml } from '../html';
import { parsePartialRID as parsePartialRIDPage } from '../parsers/PartialRID';

const parsePartialRID = (html: string) => parsePartialRIDPage(loadHtml(html));

const updatedAt = '03/02/2030 10:30';

function page(results: string, receipts = '') {
  return `<table><tr><td>
    <div class="divContentBox"><div class="divContentBoxBody">
      <div>Atualizado em: <b>${updatedAt}</b>
        <table class="reportTable">${results}</table>
      </div>
      <div>${receipts}</div>
    </div></div>
  </td></tr></table>`;
}

const header = `<tr>
  <th>Disciplina</th><th>Turma</th><th>Vagas</th>
  <th>Pedidos</th><th>Posição</th><th>Situação</th>
</tr>`;

const firstSubject = `<tr>
  <td>ABC01-10001 ÁLGEBRA I</td><td>1</td><td>30</td>
  <td>32</td><td>12</td><td>Classificado</td>
</tr>`;

describe('parsePartialRID', () => {
  it('reads only provisional results, excluding layout, notes and receipt tables', () => {
    const html = page(
      `${header}${firstSubject}
      <tr><td>DEF02-10002 FÍSICA II</td><td>2</td><td>40</td>
        <td>50</td><td>42</td><td>Excedente</td></tr>
      <tr><td>ABCD03-10003 HISTÓRIA</td><td>3</td><td>20</td>
        <td>18</td><td>9</td><td>Classificado</td></tr>`,
      `<b>Recibo de inscrição</b><table>
        <tr><td>1</td><td>ABC01-10001 ÁLGEBRA I</td><td>1</td>
          <td>30</td><td>32</td><td>12</td><td>Inscrito</td><td>Recibo</td></tr>
        <tr><td colspan="8">Observações sobre o resultado</td></tr>
        <tr><td>2</td><td>DEF02-10002 FÍSICA II</td><td>2</td>
          <td>40</td><td>50</td><td>42</td><td>Inscrito</td><td>Recibo</td></tr>
      </table>
      <table class="reportTable"><tr><td>Nota</td><td>Data</td>
        <td>1</td><td>2</td><td>3</td><td>Observação</td></tr></table>`,
    );

    expect(parsePartialRID(html)).toEqual({
      updatedAt,
      subjects: [
        {
          id: 'ABC01-10001',
          name: 'Álgebra I',
          classNumber: '1',
          available: 30,
          requested: 32,
          position: 12,
          status: 'Classificado',
        },
        {
          id: 'DEF02-10002',
          name: 'Física II',
          classNumber: '2',
          available: 40,
          requested: 50,
          position: 42,
          status: 'Excedente',
        },
        {
          id: 'ABCD03-10003',
          name: 'História',
          classNumber: '3',
          available: 20,
          requested: 18,
          position: 9,
          status: 'Classificado',
        },
      ],
    });
  });

  it('reads nested text and tbody rows without splitting a subject across rows', () => {
    const html = page(`<thead>${header}</thead><tbody>
      <tr>
        <td><a href="#subject">ABCD04-10004</a> <span>ÁLGEBRA II</span></td>
        <td><span> 01 </span></td><td><b> 25 </b></td>
        <td><span> 28 </span></td><td><span> 0 </span></td>
        <td><span> Aguardando </span></td>
      </tr>
    </tbody>`);

    expect(parsePartialRID(html)).toEqual({
      updatedAt,
      subjects: [
        {
          id: 'ABCD04-10004',
          name: 'Álgebra II',
          classNumber: '01',
          available: 25,
          requested: 28,
          position: 0,
          status: 'Aguardando',
        },
      ],
    });
  });

  it('ignores headers, incomplete rows and merged cells without shifting columns', () => {
    const html = page(`${header}
      <tr><td>Disciplina</td><td>Turma</td><td>Vagas</td>
        <td>Pedidos</td><td>Posição</td><td>Situação</td></tr>
      <tr><td colspan="6">Nenhum resultado para esta opção</td></tr>
      <tr><td>XYZ01-99999 INCOMPLETA</td><td>1</td><td>2</td><td>3</td><td>4</td></tr>
      <tr><td colspan="2">XYZ01-99998 MESCLADA</td><td>1</td><td>2</td>
        <td>3</td><td>4</td><td>5</td></tr>
      ${firstSubject}`);

    const result = parsePartialRID(html);
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0]).toMatchObject({
      id: 'ABC01-10001',
      classNumber: '1',
      position: 12,
      status: 'Classificado',
    });
  });

  it('keeps a legitimate empty result and its update time', () => {
    expect(parsePartialRID(page(header))).toEqual({ subjects: [], updatedAt });
    expect(
      parsePartialRID(page('<tr><td colspan="6">Sem inscrições</td></tr>')),
    ).toEqual({ subjects: [], updatedAt });
  });

  it.each(['<div><div>Não há resultado provisório disponível</div></div>'])(
    'returns an empty result when no result table or update time exists',
    html => {
      expect(parsePartialRID(html)).toEqual({ subjects: [], updatedAt: '' });
    },
  );
});
