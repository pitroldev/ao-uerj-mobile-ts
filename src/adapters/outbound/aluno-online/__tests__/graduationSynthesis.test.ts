import { AppError } from '@root/shared/errors/AppError';
import {
  graduationSynthesisPage,
  synthesisPeriodRows,
} from '../__fixtures__/graduationSynthesisPage';
import { loadHtml } from '../html';
import { parseGraduationSynthesis } from '../parsers/GraduationSynthesis';

const parse = (html: string) => parseGraduationSynthesis(loadHtml(html));

describe('parseGraduationSynthesis', () => {
  it('reads the curriculum, the official CR and the periods to graduate', () => {
    const synthesis = parse(graduationSynthesisPage());
    expect(synthesis).toMatchObject({
      curriculumVersion: '2 - Currículo de Exemplo de 2019 (FEX)',
      regime: 'Crédito',
      cr: 7.15,
      periods: { minimum: 10, used: 6, maximum: 14, remaining: 9, extra: 1 },
      currentPeriod: '2026.1',
    });
  });

  it('keeps each mandatory group with its branch and names the elective groups', () => {
    const { requirements } = parse(graduationSynthesisPage());
    expect(requirements).toEqual([
      {
        kind: 'MANDATORY',
        label: 'Grupo de Obrigatórias',
        branch: '10 - Engenharia - Parte Comum (FEN0001)',
        done: 120,
        required: 120,
      },
      {
        kind: 'MANDATORY',
        label: 'Grupo de Obrigatórias',
        branch: '200 - Módulo Profissional Exemplo',
        done: 40,
        required: 60,
      },
      {
        kind: 'RESTRICTED',
        label: 'Grupo de Eletivas: Disciplinas Restritas',
        branch: null,
        done: 4,
        required: 16,
      },
      expect.objectContaining({ kind: 'DEFINED', done: 0, required: 8 }),
      expect.objectContaining({ kind: 'UNIVERSAL', done: 4, required: 4 }),
      expect.objectContaining({ kind: 'ELECTIVES', done: 8, required: 28 }),
    ]);
  });

  it('has no current period between enrollments', () => {
    const html = graduationSynthesisPage({
      periods: synthesisPeriodRows([
        ['2025/1', 'Cursado'],
        ['2025/2', 'Trancado por Solicitação'],
        ['2026/1', 'Concomitância 2026'],
      ]),
    });
    expect(parse(html).currentPeriod).toBeNull();
  });

  it('accepts blank counters and rejects a page without the boxes', () => {
    const html = graduationSynthesisPage({
      counters: {
        minimum: '',
        used: '-',
        maximum: '12',
        remaining: '',
        extra: '',
      },
    });
    expect(parse(html).periods).toEqual({
      minimum: null,
      used: null,
      maximum: 12,
      remaining: null,
      extra: null,
    });
    expect(() =>
      parse('<html><body><p>Sessão expirada</p></body></html>'),
    ).toThrow(new AppError('PORTAL_LAYOUT_CHANGED'));
  });
});
