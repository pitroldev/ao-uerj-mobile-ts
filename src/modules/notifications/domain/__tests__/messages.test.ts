import type { StudentDocument } from '@root/modules/documents/domain/models';
import type { GradeChange, RidChange } from '../changes';
import { documentMessage, gradeMessage, ridMessage } from '../messages';

const change = (grades: GradeChange['grades']): GradeChange => ({
  subjectId: 'IME02-00001',
  subjectName: 'Cálculo II',
  classNumber: '3',
  grades,
});

describe('gradeMessage', () => {
  it('names the subject and the exam without the value by default', () => {
    expect(
      gradeMessage(change([{ key: 'p2', value: 8.5, previous: null }]), false),
    ).toEqual({
      id: 'grades:IME02-00001:3',
      channel: 'grades',
      title: 'Nova nota em Cálculo II',
      body: 'Saiu a nota da P2.',
      publicTitle: 'Nova nota no Aluno Online',
      publicBody: 'Toque para ver no AO UERJ.',
      target: 'home',
    });
  });

  it.each([
    [
      [
        { key: 'p2', value: 8.5, previous: null },
        { key: 'result', value: 7.8, previous: null },
      ],
      'Novas notas em Cálculo II',
      'Saíram as notas da P2 e da média.',
    ],
    [
      [{ key: 'p1', value: 6, previous: 5.5 }],
      'Nota alterada em Cálculo II',
      'A nota da P1 foi alterada.',
    ],
    [
      [
        { key: 'p1', value: 6, previous: 5.5 },
        { key: 'pf', value: 7, previous: null },
      ],
      'Notas novas e alteradas em Cálculo II',
      'Notas novas ou alteradas: P1 e PF.',
    ],
  ] as const)('summarizes %j', (grades, title, body) => {
    const message = gradeMessage(change([...grades]), false);
    expect(message.title).toBe(title);
    expect(message.body).toBe(body);
  });

  it('shows the values only when the student asked for them', () => {
    expect(
      gradeMessage(
        change([
          { key: 'p1', value: 6, previous: 5.5 },
          { key: 'result', value: 10, previous: null },
        ]),
        true,
      ).body,
    ).toBe('P1: 6,0 (antes 5,5) · Média: 10,0');
  });

  it('keeps the second decimal place when the grade has one', () => {
    const message = gradeMessage(
      change([{ key: 'result', value: 7.8, previous: 7.75 }]),
      true,
    );
    expect(message.body).toBe('Média: 7,8 (antes 7,75)');
    expect(message.publicTitle).toBe('Nota alterada no Aluno Online');
  });
});

const rid = (overrides: Partial<RidChange> = {}): RidChange => ({
  subjectId: 'IME02-00001',
  subjectName: 'Cálculo II',
  classNumber: '3',
  available: 40,
  position: 5,
  previousPosition: 12,
  status: 'Em análise',
  statusChanged: false,
  ...overrides,
});

describe('ridMessage', () => {
  it.each([
    [rid(), 'Sua posição passou de 12 para 5, com 40 vagas.'],
    [rid({ previousPosition: null }), 'Sua posição: 5, com 40 vagas.'],
    [rid({ previousPosition: 0 }), 'Sua posição agora é 5, com 40 vagas.'],
    [rid({ available: 1 }), 'Sua posição passou de 12 para 5, com 1 vaga.'],
    [
      rid({
        position: 31,
        previousPosition: 28,
        status: 'Excedente',
        statusChanged: true,
      }),
      'Sua posição passou de 28 para 31, com 40 vagas. Situação: Excedente.',
    ],
    [
      rid({ position: 0, status: 'Choque de horário' }),
      'Sem posição: Choque de horário.',
    ],
    [
      rid({ previousPosition: 5, status: 'Atendido', statusChanged: true }),
      'Situação: Atendido.',
    ],
  ])('describes %j', (input, body) => {
    expect(ridMessage(input)).toMatchObject({
      id: 'rid:IME02-00001:3',
      channel: 'enrollment',
      title: 'RID: Cálculo II',
      body,
      target: 'home',
    });
  });
});

describe('documentMessage', () => {
  const document: StudentDocument = {
    id: '1:2:3',
    title: 'Declaração de Matrícula',
    validUntil: '20/10/2026',
    hasExistingDocument: true,
    canIssue: true,
    canDelete: true,
    revision: '3',
  };

  it.each([
    [0, 'Documento vence hoje'],
    [1, 'Documento vence amanhã'],
    [3, 'Documento vence em 3 dias'],
  ])('%p days left: %s', (daysLeft, title) => {
    expect(documentMessage({ document, daysLeft })).toEqual({
      id: 'documents:1:2:3',
      channel: 'documents',
      title,
      body: 'Declaração de Matrícula: válido até 20/10/2026.',
      publicTitle: title,
      publicBody: 'Toque para ver no AO UERJ.',
      target: 'documents',
    });
  });
});
