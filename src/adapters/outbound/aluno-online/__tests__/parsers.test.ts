import { loadHtml, type CheerioAPI } from '../html';
import { parseClassGrades, parseGrade } from '../parsers/ClassGrades';
import { parseCurriculumSubjects } from '../parsers/CurriculumSubjects';
import { parseSubjectsTaken } from '../parsers/SubjectsTaken';
import { parseUniversalSubjects } from '../parsers/UniversalSubjects';
import { parsePartialRID } from '../parsers/PartialRID';
import { parseAttendedClassesSchedule } from '../parsers/AttendedClassesSchedule';
import { parseSubjectInfo } from '../parsers/SubjectInfo';
import { optionalNumber } from '../parsers/contract';
import {
  parseLoginInfo,
  rejectsCredentials,
  reportsUnavailableAccount,
} from '../parsers/parseLoginData';
import { subjectPage } from '../__fixtures__/subjectPage';
import { historyPage, historyRow } from '../__fixtures__/historyPage';
import { calculateCraProgression } from '@root/modules/academics/domain/rules/progress';
import {
  rejectedLoginPage,
  unknownMatriculaLoginPage,
} from '../__fixtures__/loginPages';

const fromHtml =
  <T>(parser: ($: CheerioAPI) => T) =>
  (html: string) =>
    parser(loadHtml(html));
const parseGrades = fromHtml(parseClassGrades);
const parseCurriculum = fromHtml(parseCurriculumSubjects);
const parseHistory = fromHtml(parseSubjectsTaken);
const parseUniversal = fromHtml(parseUniversalSubjects);
const parsePartialRid = fromHtml(parsePartialRID);
const parseSchedule = fromHtml(parseAttendedClassesSchedule);
const parseSubject = fromHtml(parseSubjectInfo);

const cells = (values: string[]) =>
  `<tr>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
const table = (headers: string[], rows = '', className = '') =>
  `<table class="${className}"><tr>${headers
    .map(value => `<th>${value}</th>`)
    .join('')}</tr>${rows}</table>`;
const content = (body: string) =>
  `<div class="divContentBoxBody">${body}</div>`;
const gradeHeaders = ['Disciplina', 'Turma', 'P1', 'P2', 'PF', 'Média'];
const curriculumHeaders = [
  'Disciplina',
  'Período',
  'Realizada',
  'Tipo',
  'Ramo',
  'Créditos',
  'Carga',
  'Mínimo',
  'Período atual',
];
const historyHeaders = [
  'Período',
  'Disciplina',
  'Créditos',
  'Carga',
  'Tipo',
  'Frequência',
  'Nota',
  'Situação',
];

it.each([
  '',
  '<p>Portal fora do ar</p>',
  '<div class="divContentBoxBody"><table><tr><td>Layout novo</td></tr></table></div>',
])(
  'rejects unrecognized academic layouts without presenting an empty list',
  html => {
    [
      parseGrades,
      parseCurriculum,
      parseHistory,
      parseUniversal,
      parsePartialRid,
      parseSubject,
    ].forEach(parser => {
      expect(() => parser(html)).toThrow('PORTAL_LAYOUT_CHANGED');
    });
  },
);

it('recognizes legitimate empty tables by their academic structure', () => {
  expect(parseGrades(table(gradeHeaders, '', 'reportTable'))).toEqual([]);
  expect(parseCurriculum(content(table(curriculumHeaders)))).toEqual([]);
  expect(parseHistory(content(table(historyHeaders)))).toEqual([]);
  expect(
    parseUniversal(
      content(table(['Disciplina', 'Créditos', 'Carga', 'Atual'])),
    ),
  ).toEqual([]);
});

it.each(['', ' ', '-', '—'])('keeps a missing grade %j as null', input => {
  expect(parseGrade(input)).toBeNull();
});

it.each(['erro', '7,5x', 'NaN', 'Infinity'])(
  'rejects malformed numeric input %j instead of returning NaN',
  input => {
    expect(() => optionalNumber(input)).toThrow('PORTAL_LAYOUT_CHANGED');
  },
);

it('preserves decimal grades and numeric zero', () => {
  const html = table(
    gradeHeaders,
    cells(['ABCD01-12345 ÁLGEBRA II', '01', '7,5', '0', '-', '8,25']),
    'reportTable',
  );
  expect(parseGrades(html)).toEqual([
    {
      id: 'ABCD01-12345',
      name: 'Álgebra II',
      class: '01',
      grades: { p1: 7.5, p2: 0, pf: null, result: 8.25 },
    },
  ]);
});

it('rejects missing columns or unknown subject IDs in grades', () => {
  expect(() =>
    parseGrades(
      table(
        gradeHeaders,
        cells(['ABC01-12345 ÁLGEBRA', '1', '8']),
        'reportTable',
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
  expect(() =>
    parseGrades(
      table(
        gradeHeaders,
        cells(['UNKNOWN', '1', '8', '8', '-', '8']),
        'reportTable',
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('preserves zero credits and required minimums in curriculum', () => {
  const html = content(
    table(
      curriculumHeaders,
      cells([
        'ABC01-12345 ÁLGEBRA',
        '1',
        'Não',
        'Obrigatória',
        '-',
        '0',
        '30',
        '0',
        'Sim',
      ]),
    ),
  );
  expect(parseCurriculum(html)[0]).toMatchObject({
    credits: 0,
    workload: 30,
    minimum_credits: 0,
    type: 'MANDATORY',
    subjectOfPeriod: true,
  });
});

it('sets the universal subject category instead of leaving it undefined', () => {
  const html = content(
    table(
      ['Disciplina', 'Créditos', 'Carga', 'Atual'],
      cells(['ABC01-12345 ÁLGEBRA', '0', '30', 'Sim']),
    ),
  );
  expect(parseUniversal(html)[0]).toMatchObject({
    id: 'ABC01-12345',
    credits: 0,
    type: 'UNIVERSAL',
  });
});

it('keeps every history attempt when the portal leaves subsequent period cells empty', () => {
  const html = content(
    table(
      historyHeaders,
      [
        [
          '2025/1',
          'ABC01-12345 ÁLGEBRA',
          '4',
          '60',
          'Obrigatória',
          '100%',
          '4,5',
          'Reprov. Nota',
        ],
        [
          '',
          'ABC01-12346 FÍSICA',
          '4',
          '60',
          'Obrigatória',
          '60%',
          '5',
          'Reprov. Freq.',
        ],
        [
          '2025/2',
          'ABC01-12345 ÁLGEBRA',
          '4',
          '60',
          'Obrigatória',
          '100%',
          '8',
          'Aprov. Nota',
        ],
        [
          '',
          'ABC01-12347 QUÍMICA',
          '4',
          '60',
          'Obrigatória',
          '-',
          '-',
          'Cancelado',
        ],
        [
          '',
          'ABC01-12348 PROJETO',
          '0',
          '30',
          'Obrigatória',
          '-',
          '-',
          'Em Preparo',
        ],
      ]
        .map(cells)
        .join(''),
    ),
  );
  const history = parseHistory(html);
  expect(history).toHaveLength(5);
  expect(history.map(item => [item.period, item.status])).toEqual([
    ['2025.1', 'FAILED_BY_GRADE'],
    ['2025.1', 'FAILED_BY_ATTENDANCE'],
    ['2025.2', 'APPROVED'],
    ['2025.2', 'CANCELED'],
    ['2025.2', 'IN_PROGRESS'],
  ]);
  expect(history.filter(item => item.id === 'ABC01-12345')).toHaveLength(2);
});

it('accepts explicit exemption rows and rejects unknown completion status', () => {
  const exemption = content(
    table(
      historyHeaders,
      cells([
        'Isento',
        'ABC01-12345 ÁLGEBRA',
        '4',
        '60',
        'Obrigatória',
        '-',
        '-',
        'Isento',
      ]),
    ),
  );
  expect(parseHistory(exemption)[0]).toMatchObject({
    period: 'Isento',
    status: 'EXEMPT',
    grade: null,
  });
  const unknown = content(
    table(
      historyHeaders,
      cells([
        '2025/1',
        'ABC01-12345 ÁLGEBRA',
        '4',
        '60',
        'Obrigatória',
        '100%',
        '8',
        'Alterado',
      ]),
    ),
  );
  expect(() => parseHistory(unknown)).toThrow('PORTAL_LAYOUT_CHANGED');
});

const attempt = (lead: string[], subject: string, status = 'Aprov. Nota') =>
  cells([...lead, subject, '4', '60', 'Obrigatória', '100%', '8', status]);

it('finds the subject wherever its code is in the row, with the period around it', () => {
  const history = parseHistory(
    content(
      table(
        historyHeaders,
        [
          // período com texto a mais na célula
          attempt(['2024/2 (*)'], 'ABC01-12345 ÁLGEBRA'),
          // uma célula vazia a mais antes da disciplina
          attempt(['', ''], 'ABC01-12346 FÍSICA'),
          // sem a célula do período (rowspan)
          attempt([], 'ABC01-12347 QUÍMICA', 'Reprov. Nota'),
        ].join(''),
      ),
    ),
  );
  expect(history.map(({ id, period, status }) => [id, period, status])).toEqual(
    [
      ['ABC01-12345', '2024.2', 'APPROVED'],
      ['ABC01-12346', '2024.2', 'APPROVED'],
      ['ABC01-12347', '2024.2', 'FAILED_BY_GRADE'],
    ],
  );
  expect(history[0]).toMatchObject({
    name: 'Álgebra',
    credits: 4,
    workload: 60,
    frequency: 100,
    grade: 8,
  });
});

it('keeps the period of complementary activities out of the attempts', () => {
  const history = parseHistory(
    content(
      table(
        ['Período', 'Nome', 'CH', 'Descrição'],
        cells(['2023/1', 'Monitoria', '30', 'Participação']),
      ) +
        table(
          historyHeaders,
          attempt(['2024/2'], 'ABC01-12345 ÁLGEBRA') +
            cells(['2025/1', 'Extensão', '20', 'Participação']) +
            attempt([''], 'ABC01-12346 FÍSICA'),
        ),
    ),
  );
  expect(history.map(item => item.period)).toEqual(['2024.2', '2024.2']);
});

it.each([
  ['a code it does not recognize', attempt(['2024/2'], 'ÁLGEBRA')],
  [
    'unknown text before the code',
    attempt(['Turma extra'], 'ABC01-12345 ÁLGEBRA'),
  ],
  [
    'missing fields after the code',
    cells([
      '2024/2',
      'ABC01-12345 ÁLGEBRA',
      '4',
      '60',
      'Obrigatória',
      '100%',
      '8',
    ]),
  ],
])('fails instead of dropping an attempt with %s', (_case, row) => {
  expect(() => parseHistory(content(table(historyHeaders, row)))).toThrow(
    'PORTAL_LAYOUT_CHANGED',
  );
});

it('reads the nested full history page without turning summary or complementary activity cells into attempts', () => {
  const history = parseHistory(
    historyPage(
      [
        historyRow('', 'ABC01-00101', 'Isento', '-'),
        historyRow('', 'ABC01-00102', 'Isento', '-'),
        historyRow('2024/2', 'ABC01-00103', 'Aprov. Nota', '8,0'),
        historyRow('', 'ABC01-00104', 'Aprov. Nota', '9,0'),
        historyRow('2025/2', 'ABC01-00103', 'Reprov. Nota', '4,0'),
        historyRow('', 'ABC01-00105', 'Cancelado', '-'),
      ].join(''),
    ),
  );
  expect(history).toHaveLength(6);
  expect(
    history.map(({ id, period, status }) => ({ id, period, status })),
  ).toEqual([
    { id: 'ABC01-00101', period: 'Isento', status: 'EXEMPT' },
    { id: 'ABC01-00102', period: 'Isento', status: 'EXEMPT' },
    { id: 'ABC01-00103', period: '2024.2', status: 'APPROVED' },
    { id: 'ABC01-00104', period: '2024.2', status: 'APPROVED' },
    { id: 'ABC01-00103', period: '2025.2', status: 'FAILED_BY_GRADE' },
    { id: 'ABC01-00105', period: '2025.2', status: 'CANCELED' },
  ]);
  expect(history.every(item => item.name === 'Disciplina de Teste II')).toBe(
    true,
  );
  expect(calculateCraProgression(history)).toEqual({
    currentCRA: 7,
    pointsOverTime: [
      { label: '2024.2', cra: 8.5 },
      { label: '2025.2', cra: 7 },
    ],
  });
});

it('rejects nonnumeric RID availability without leaking NaN into the domain', () => {
  const html = table(
    ['Disciplina', 'Turma', 'Vagas', 'Pedidos', 'Posição', 'Situação'],
    cells([
      'ABC01-12345 ÁLGEBRA',
      '1',
      'indisponível',
      '12',
      '1',
      'Classificado',
    ]),
    'reportTable',
  );
  expect(() => parsePartialRid(html)).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('keeps disjoint schedule intervals separate while merging adjacent slots', () => {
  const subjects = table(
    ['Índice', 'Disciplina', 'Turma', 'AVA', 'Local'],
    cells(['1', 'ABC01-12345 ÁLGEBRA', '1', '', 'Sala']),
  );
  // Two rows per slot as rendered by the portal; M1 and M2 are adjacent,
  // M5 starts after a long gap and must remain a separate appointment.
  const scheduleRows = [
    '<tr><th>Segunda</th></tr>',
    '<tr id="start"><td>ABC01-12345</td></tr>',
    '<tr><td></td></tr>',
    '<tr><td>ABC01-12345</td></tr>',
    '<tr><td></td></tr>',
    '<tr><td></td></tr>',
    '<tr><td></td></tr>',
    '<tr><td></td></tr>',
    '<tr><td></td></tr>',
    '<tr><td>ABC01-12345</td></tr>',
  ].join('');
  const html = content(
    `<div>${subjects}</div><div><table>${scheduleRows}</table></div>`,
  );
  const result = parseSchedule(html);
  expect(result).toHaveLength(2);
  expect(
    result.map(item => [item.start_time_in_minutes, item.end_time_in_minutes]),
  ).toEqual([
    [420, 520],
    [640, 690],
  ]);
  expect(result[0].endTimeAlias).toBe('8:40');
});

it('keeps subjects without a time in the grid, after the classes', () => {
  const subjects = table(
    ['Índice', 'Disciplina', 'Turma', 'AVA', 'Local'],
    [
      cells(['1', 'ABC01-12345 ÁLGEBRA', '1', '', 'Sala 1']),
      cells(['2', 'ABC01-54321 ESTÁGIO SUPERVISIONADO III', '2', '', '-']),
    ].join(''),
  );
  const scheduleRows = [
    '<tr><th>Segunda</th></tr>',
    '<tr id="start"><td>ABC01-12345</td></tr>',
  ].join('');
  const result = parseSchedule(
    content(`<div>${subjects}</div><div><table>${scheduleRows}</table></div>`),
  );
  expect(
    result.map(item => [
      item.subject_id,
      item.dayNumber,
      item.start_time_in_minutes,
    ]),
  ).toEqual([
    ['ABC01-12345', 1, 420],
    ['ABC01-54321', 0, -1],
  ]);
  expect(result[1].class).toMatchObject({
    name: 'Estágio Supervisionado III',
    class: '2',
  });

  // só disciplinas sem horário (fim do curso): a grade vem vazia, elas não
  const onlyUntimed = parseSchedule(
    content(
      `<div>${table(
        ['Índice', 'Disciplina', 'Turma', 'AVA', 'Local'],
        cells(['1', 'ABC01-54321 ESTÁGIO SUPERVISIONADO III', '2', '', '-']),
      )}</div><div><table><tr><th>Segunda</th></tr></table></div>`,
    ),
  );
  expect(onlyUntimed.map(item => item.subject_id)).toEqual(['ABC01-54321']);
});

it('reads subject details and classes from a class table without an explicit tbody', () => {
  const subject = parseSubject(subjectPage);
  expect(subject).toMatchObject({
    id: 'ABC01-04827',
    code: 4827,
    name: 'Álgebra Linear II',
    credits: 4,
    workload: 60,
    timesPerWeek: 4,
    universal: false,
    conflito: true,
    preparo: false,
    prerequisite: [
      [
        { id: 'ABC01-04826', name: 'Álgebra Linear I' },
        { id: 'ABC01-04825', name: 'Geometria Analítica' },
      ],
      [{ id: 'Trava de Créditos', name: '60 Créditos Obrigatórios' }],
    ],
  });
  expect(subject.classes).toHaveLength(2);
  expect(subject.classes[0]).toMatchObject({
    classNumber: 1,
    hasPreference: true,
    schedule: [{ Segunda: [['M1', 'M2']] }, { Quarta: [['M1', 'M2']] }],
    location: 'Pavilhão Central - Sala 6001',
    teachers: ['Professora de Teste', 'Professor da Silva & Souza'],
    vacancies: {
      uerj: {
        available: 40,
        taken: 35,
        requestedAvailable: 20,
        requestedTaken: 15,
        preferential: 5,
      },
      freshman: { requestedAvailable: 6, requestedTaken: 4, preferential: 1 },
    },
  });
  expect(subject.classes[1]).toMatchObject({
    classNumber: 2,
    hasPreference: false,
    schedule: [{ Terça: [['T3', 'T4']] }, { Sábado: [['M3']] }],
    location: 'Sala 5038 — Bloco F',
    teachers: ['Docente dos Santos'],
    vacancies: { uerj: { available: 30, taken: 0, requestedTaken: 0 } },
  });
});

it('does not read the unknown-or-maintenance warning as a wrong password', () => {
  const warning = (html: string) => parseLoginInfo(loadHtml(html)).fail_reason;
  const unavailable = warning(unknownMatriculaLoginPage);
  expect(unavailable).toMatch(/manutenção/);
  expect(rejectsCredentials(unavailable)).toBe(false);
  expect(reportsUnavailableAccount(unavailable)).toBe(true);

  const rejected = warning(rejectedLoginPage);
  expect(rejectsCredentials(rejected)).toBe(true);
  expect(reportsUnavailableAccount(rejected)).toBe(false);
  expect(rejectsCredentials('Matrícula inexistente.')).toBe(true);
});
