import {
  creditsAndHours,
  groupSchedule,
  isCreditLock,
  joinPt,
  plural,
  requirementMet,
  syllabusUrl,
  vacancyInfo,
} from '../subjectFormat';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';

describe('subject details formatting', () => {
  it('groups days that share the same time range', () => {
    const groups = groupSchedule([
      { Quarta: [['M3', 'M4']] },
      { Segunda: [['M3', 'M4']] },
      { Sexta: [['T1']] },
    ]);
    expect(groups.map(g => g.text)).toEqual([
      'Segunda e Quarta · M3–M4 · 8:50–10:30',
      'Sexta · T1 · 12:20–13:20',
    ]);
    expect(groups[0].accessibilityLabel).toBe(
      'Segunda e Quarta, M3 a M4, 8:50 às 10:30',
    );
  });

  it('ignores empty blocks and unknown times without crashing', () => {
    expect(groupSchedule(undefined)).toEqual([]);
    expect(groupSchedule([{ Terça: [[]] }])).toEqual([]);
    expect(groupSchedule([{ Terça: [['X9' as never]] }])[0].text).toBe(
      'Terça · X9',
    );
  });

  it('labels vacancies with the app health rule, never by colour alone', () => {
    expect(vacancyInfo('Solicitadas', 38, 40)).toMatchObject({
      text: '38/40',
      tone: 'bad',
      label: 'Crítico',
      accessibilityLabel: 'Solicitadas: 38 de 40, Crítico',
    });
    expect(vacancyInfo('Ocupadas', 20, 40)).toMatchObject({
      tone: 'warn',
      label: 'Atenção',
      fill: 0.5,
    });
    expect(vacancyInfo('Ocupadas', 4, 40)).toMatchObject({
      tone: 'good',
      label: 'Bom',
    });
    expect(vacancyInfo('Ocupadas', 40, 40)).toMatchObject({
      tone: 'bad',
      label: 'Lotada',
      fill: 1,
    });
    expect(vacancyInfo('Ocupadas', 0, 0).label).toBe('Sem vagas');
    expect(vacancyInfo('Ocupadas', undefined, 40)).toMatchObject({
      text: '–',
      tone: 'neutral',
      label: 'Sem dado',
    });
  });

  it('marks requirements already met from the saved history', () => {
    const history = [
      { id: 'IME02-10860', period: '2025.1', status: 'FAILED_BY_GRADE' },
      { id: 'IME02-10860', period: '2025.2', status: 'APPROVED' },
      { id: 'IME02-10862', period: 'Isento', status: 'EXEMPT' },
    ] as SubjectsTaken[];
    expect(requirementMet('IME02-10860', history)).toBe('Aprovado em 2025.2');
    expect(requirementMet('IME02-10862', history)).toBe('Isento');
    expect(requirementMet('IME02-99999', history)).toBeNull();
    expect(requirementMet('IME02-10860', undefined)).toBeNull();
  });

  it('keeps the small text helpers in Portuguese', () => {
    expect(plural(1, 'turma', 'turmas')).toBe('1 turma');
    expect(plural(3, 'turma', 'turmas')).toBe('3 turmas');
    expect(joinPt(['Terça', 'Quinta', 'Sexta'])).toBe('Terça, Quinta e Sexta');
    expect(creditsAndHours(4, 60)).toBe('4 créditos · 60 horas');
    expect(creditsAndHours(1, null)).toBe('1 crédito');
    expect(creditsAndHours(undefined, undefined)).toBe('');
    expect(isCreditLock('Trava de Créditos')).toBe(true);
    expect(isCreditLock('IME02-10860')).toBe(false);
    expect(syllabusUrl('IME02-10892')).toBe(
      'https://www.ementario.uerj.br/ementa.php?cdg_disciplina=10892',
    );
    expect(syllabusUrl(10892)).toBe(
      'https://www.ementario.uerj.br/ementa.php?cdg_disciplina=10892',
    );
  });
});
