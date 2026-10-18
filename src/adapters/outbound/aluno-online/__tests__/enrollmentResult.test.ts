import { AppError } from '@root/shared/errors/AppError';
import {
  enrollmentResultPage,
  enrollmentSection,
  enrollmentSubject,
} from '../__fixtures__/enrollmentResultPage';
import { loadHtml } from '../html';
import { parseEnrollmentResult } from '../parsers/EnrollmentResult';

const parse = (html: string) => parseEnrollmentResult(loadHtml(html));

describe('parseEnrollmentResult', () => {
  it('reads each subject once, with the section that accepted or refused it', () => {
    const html = enrollmentResultPage(
      `${enrollmentSection('Inscrição ACEITA')}
      ${enrollmentSubject('ABC01-10001 ÁLGEBRA LINEAR I', '3', 4)}
      ${enrollmentSubject('DEF02-10002 FÍSICA II', '1')}
      ${enrollmentSection('Inscrição NÃO ACEITA - Falta Requisito ( CO / PRE )')}
      ${enrollmentSubject('GHI03-10003 QUÍMICA GERAL', '2', 3)}`,
    );
    expect(parse(html)).toEqual({
      subjects: [
        {
          id: 'ABC01-10001',
          name: 'Álgebra Linear I',
          classNumber: '3',
          accepted: true,
          reason: '',
        },
        {
          id: 'DEF02-10002',
          name: 'Física II',
          classNumber: '1',
          accepted: true,
          reason: '',
        },
        {
          id: 'GHI03-10003',
          name: 'Química Geral',
          classNumber: '2',
          accepted: false,
          reason: 'Falta Requisito (CO/PRE)',
        },
      ],
    });
  });

  it('accepts a page with no result yet', () => {
    expect(
      parse(
        '<div class="divContentBoxBody">Não há resultado da inscrição a ser apresentado.</div>',
      ),
    ).toEqual({ subjects: [] });
  });

  it.each([
    [
      'a page without the table or the notice',
      '<div>Página em manutenção</div>',
    ],
    [
      'a subject before any section',
      enrollmentResultPage(enrollmentSubject('ABC01-10001 ÁLGEBRA I', '3')),
    ],
    [
      'a subject row without the code',
      enrollmentResultPage(
        `${enrollmentSection('Inscrição ACEITA')}${enrollmentSubject('DISCIPLINA SEM CÓDIGO', '3')}`,
      ),
    ],
    [
      'a section that is neither accepted nor refused',
      enrollmentResultPage(
        `${enrollmentSection('Inscrição EM ANÁLISE')}${enrollmentSubject('ABC01-10001 ÁLGEBRA I', '3')}`,
      ),
    ],
  ])('rejects %s as a layout change', (_case, html) => {
    expect(() => parse(html)).toThrow(new AppError('PORTAL_LAYOUT_CHANGED'));
  });
});
