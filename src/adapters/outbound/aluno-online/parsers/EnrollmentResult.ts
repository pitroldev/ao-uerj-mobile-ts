import type {
  EnrollmentResult,
  EnrollmentResultEntry,
} from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { requireStructure, subjectIdPattern } from './contract';
import { parseSubjectName } from './values';

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** "Falta Requisito ( CO / PRE )" → "Falta Requisito (CO/PRE)". */
function reasonOf(title: string): string {
  return clean(
    title
      .split(/\s+-\s+/)
      .slice(1)
      .join(' - '),
  )
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*\/\s*/g, '/');
}

/**
 * "RID: Resultado da Inscrição": a tabela `#smallfont` com o cabeçalho
 * Disciplina/Créditos/…/Horário, dividida em seções em negrito ("Inscrição
 * ACEITA", "Inscrição NÃO ACEITA - motivo"). Cada disciplina abre com o
 * código na primeira coluna; as linhas seguintes sem código são outros
 * horários dela. A tabela de ramificações e as notas ficam de fora.
 */
export function parseEnrollmentResult($: CheerioAPI): EnrollmentResult {
  // a tabela mais interna com a coluna Disciplina (a de layout a contém)
  const table = $('table')
    .filter(
      (_index, element) =>
        $(element).find('table').length === 0 &&
        $(element)
          .find('th')
          .toArray()
          .some(cell => /^disciplina$/i.test(clean($(cell).text()))),
    )
    .first();
  if (!table.length) {
    // fora do período a página só traz um aviso ("não há resultado…")
    const text = clean($.root().text());
    requireStructure(
      /n[ãa]o (h[áa]|consta|existe)[^.]{0,80}(resultado|inscri)/i.test(text),
    );
    return { subjects: [] };
  }

  const subjects: EnrollmentResultEntry[] = [];
  let section: { accepted: boolean; reason: string } | null = null;
  table.find('tr').each((_index, row) => {
    const cells = $(row).children('td');
    if (cells.length === 1) {
      const title = clean(cells.text());
      if (/^inscri[çc][ãa]o\b/i.test(title)) {
        const refused = /n[ãa]o\s+aceita/i.test(title);
        requireStructure(refused || /\baceita\b/i.test(title));
        section = {
          accepted: !refused,
          reason: refused ? reasonOf(title) : '',
        };
      }
      return;
    }
    if (cells.length !== 7) return;
    const subject = clean(cells.eq(0).text());
    // outro horário da disciplina anterior
    if (!subject) return;
    const id = subject.match(subjectIdPattern)?.[0];
    requireStructure(id && section);
    const classNumber = clean(cells.eq(4).text());
    requireStructure(classNumber);
    subjects.push({
      id,
      name: parseSubjectName(subject),
      classNumber,
      ...section,
    });
  });
  return { subjects };
}
