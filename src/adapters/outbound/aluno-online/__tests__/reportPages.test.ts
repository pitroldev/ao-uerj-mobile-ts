import { AppError } from '@root/shared/errors/AppError';
import { loadHtml } from '../html';
import { MAX_PAGE_CHARS, anonymizePortalPage } from '../anonymizePage';
import { createPortalPages } from '../reportPages';

const NAME = 'Fulana Turma de Souza';
const MATRICULA = '202312345678';
const personal = [NAME, MATRICULA];

// como o portal desenha, com o que não pode sair do aparelho
const page = `<html><head><title>Aluno Online</title>
  <script>var segredo = "script-secret";</script>
  <style>.x { color: red }</style></head>
  <body><div id="menu"><a href="javascript:executaMenu(1,'menu-secret')">Notas</a></div>
  <div class="divContentBox">
    <div class="divContentBoxHeader">Aluno: FULANA TURMA DE SOUZA - Matrícula: ${MATRICULA}</div>
    <div class="divContentBoxBody">
      <!-- comentario-secreto -->
      <form><input type="hidden" name="_token" value="csrf-secret"></form>
      <img src="data:image/png;base64,${'A'.repeat(500)}">
      <div class="divContentBoxMessage">Não constam disciplinas inscritas ou canceladas.</div>
      <table class="reportTable"><tbody>
        <tr><th></th><th>Disciplina</th><th>Turma</th><th>Local AVA</th><th>Local de Aula</th></tr>
        <tr><td style="text-align: left">1.</td>
          <td onclick="abre('click-secret')">IME02-10838&nbsp;&nbsp;CÁLCULO DIFERENCIAL</td>
          <td>3</td><td>Prof. Beltrano Ciclano</td><td>Sala 5.098/F (Pav. João Lyra Filho)</td></tr>
        <tr><td colspan="2">Nota 8,5 · Aprovado · CPF 123.456.789-00 · fulana@exemplo.com</td></tr>
      </tbody></table>
      <table class="table"><tbody><tr id="id_th"><th>Tempo</th><th>Segunda</th></tr>
        <tr><th>M1 &nbsp;<font size="1px">(07:00 - 07:50)</font></th><td>IME02-10838</td></tr>
      </tbody></table>
    </div>
  </div></body></html>`;

describe('the portal page sent with a report', () => {
  const masked = anonymizePortalPage(page, { personal, label: 'schedule' });

  it('drops the student, the grades, the scripts and the secrets', () => {
    for (const secret of [
      'FULANA',
      'Fulana',
      'SOUZA',
      MATRICULA,
      '8,5',
      'Aprovado',
      '123.456.789-00',
      'fulana@exemplo.com',
      'Beltrano',
      'CÁLCULO',
      '5.098',
      'João Lyra',
      'csrf-secret',
      'script-secret',
      'menu-secret',
      'click-secret',
      'comentario-secreto',
      'base64',
      'onclick',
      'style=',
    ])
      expect(masked).not.toContain(secret);
    // "Turma" é palavra da interface, mas aqui é parte do nome do aluno
    expect(masked).toContain(
      `Aluno: XXXXXX XXXXX DE XXXXX - Matrícula: 999999999999`,
    );
    expect(masked).toContain('<th>Xxxxx</th>');
  });

  it('keeps the structure, the codes, the times, the headers and the portal messages', () => {
    expect(
      masked.startsWith('<!-- AO UERJ: página anonimizada (schedule) -->'),
    ).toBe(true);
    for (const kept of [
      'IME02-10838',
      'M1',
      '(07:00 - 07:50)',
      '<th>Disciplina</th>',
      '<th>Local de Aula</th>',
      'Não constam disciplinas inscritas ou canceladas.',
      'XXXXXXX XXXXXXXXXXX',
      'Sala 9.999/X (Xxx. Xxxx Xxxx Xxxxx)',
      'Xxxx. Xxxxxxxx Xxxxxxx',
      'Nota 9,9 · Xxxxxxxx',
      'XXX 999.999.999-99 · xxxxxx@xxxxxxx.com',
      '<tr id="id_th">',
      'class="reportTable"',
      'colspan="2"',
      'type="hidden"',
      'value="xxxx-xxxxxx"',
    ])
      expect(masked).toContain(kept);
    // o menu fica de fora: só o conteúdo da página (título e corpo)
    expect(masked).not.toContain('id="menu"');
    const $ = loadHtml(masked);
    expect($('table')).toHaveLength(2);
    expect($('tr')).toHaveLength(5);
    expect($('td')).toHaveLength(7);
  });

  it('keeps the whole body when the page has no content box', () => {
    const bare = anonymizePortalPage(
      '<html><body><p>Página não encontrada!</p><b>Fulana</b></body></html>',
      { personal, label: 'grades' },
    );
    expect(bare).toContain('<p>Página não encontrada!</p><b>Xxxxxx</b>');
  });

  it('cuts long tables until the page fits, saying how many rows left', () => {
    const rows = Array.from(
      { length: 600 },
      (_, index) =>
        `<tr><td>IME0${index % 9}-${10000 + index}</td><td>DISCIPLINA LONGA NÚMERO ${index}</td><td>Aprovado</td></tr>`,
    ).join('');
    const long = anonymizePortalPage(
      `<div class="divContentBox"><table>${rows}</table></div>`,
      { personal, label: 'history' },
    );
    expect(long.length).toBeLessThanOrEqual(MAX_PAGE_CHARS + 100);
    expect(long).toMatch(/\[5\d\d linhas cortadas\]/);
    expect(long).toContain('IME00-10000');
  });
});

describe('the pages captured for a report', () => {
  const html = (label: string) =>
    `<div class="divContentBox"><p>${label}</p></div>`;

  it('fetches each page once, anonymized, and names the reads that failed', async () => {
    const fetch = jest.fn(async (operation: string) => {
      if (operation === 'grades') throw new AppError('PORTAL_UNSTABLE');
      if (operation === 'synthesis') throw new Error('boom');
      return html(`${operation} de Fulana`);
    });
    const pages = createPortalPages({ fetch });
    // a mesma página (as atividades vêm no histórico) só uma vez; sem o
    // código, nada da disciplina; uma leitura desconhecida, nada
    const result = await pages.capture(
      [
        'schedule',
        'history',
        'complementary-activities',
        'subject-details',
        'desconhecida',
        'grades',
      ],
      { personal },
    );
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      'schedule',
      'history',
      'grades',
    ]);
    expect(result.pages.map(item => item.read)).toEqual([
      'schedule',
      'history',
    ]);
    expect(result.pages[0].html).toContain('<p>xxxxxxxx de Xxxxxx</p>');
    expect(result.failures).toEqual({ grades: 'PORTAL_UNSTABLE' });

    await expect(pages.capture(['synthesis'], { personal })).resolves.toEqual({
      pages: [],
      failures: { synthesis: 'UNKNOWN' },
    });
  });

  it('asks the page of the reported subject, and stops at three pages', async () => {
    const fetch = jest.fn(async () => html('ok'));
    const result = await createPortalPages({ fetch }).capture(
      ['subject-details', 'schedule', 'grades', 'curriculum'],
      { personal, subjectCode: 'IME02-10838' },
    );
    expect(fetch.mock.calls[0]).toEqual([
      'subjectDetails',
      { subjectId: 'IME02-10838' },
      { signal: undefined },
    ]);
    expect(result.pages).toHaveLength(3);
  });

  it('gives up on the rest when the time runs out', async () => {
    const controller = new AbortController();
    const fetch = jest.fn(async () => {
      controller.abort();
      throw new AppError('CANCELLED');
    });
    const result = await createPortalPages({ fetch }).capture(
      ['schedule', 'grades'],
      { personal, signal: controller.signal },
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pages: [], failures: { schedule: 'TIMEOUT' } });
  });
});
