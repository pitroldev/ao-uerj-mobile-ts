/*
 * Dados FICTÍCIOS do modo demonstração (somente builds de desenvolvimento).
 *
 * Espelham docs/design-proposals/shared/data.js (aluna Marina Albuquerque
 * Teixeira, período 2026.2) nos formatos que os parsers do Aluno Online
 * entregam ao domínio. Nomes, matrícula, notas, salas, docentes e mensagens
 * foram inventados; nada aqui vem do portal real.
 */
import type {
  AttendedClassesSchedule,
  AttendedSubjectInfo,
  ClassGrade,
  CurriculumSubject,
  Horario,
  PartialRidResult,
  Prereq,
  SubjectClassesSchedule,
  SubjectInfo,
  SubjectsTaken,
  Turno,
  UniversalSubject,
  WeekDay,
} from '@root/modules/academics/domain/models';
import type { Message, Teacher } from '@root/modules/community/domain/models';
import type { StudentProfile } from '@root/modules/identity/domain/types';
import type { ElectiveCreditsConfig } from '@root/modules/academics/domain/rules/progress';
import { TIME_VALUES } from '@utils/constants/time';

/**
 * Aluna fictícia. A matrícula do perfil é a digitada no login ("demo"), como
 * no adaptador real: o cofre de credenciais exige que as duas coincidam. A do
 * protótipo (202310045612) não é usada para não se passar por uma real.
 */
export const DEMO_STUDENT: Omit<StudentProfile, 'matricula'> = {
  name: 'Marina Albuquerque Teixeira',
  period: '2026.2',
};

/** Créditos eletivos já configurados, como no protótipo (Meu Progresso). */
export const DEMO_ELECTIVE_CREDITS: ElectiveCreditsConfig = {
  RESTRICTED: 16,
  DEFINED: 8,
  UNIVERSAL: 4,
};

/* ------------------------------------------------------------- tempo */

type Day = 1 | 2 | 3 | 4 | 5 | 6;
type Meeting = { day: Day; from: Turno; to: Turno };

const WEEKDAY: Record<Day, WeekDay> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

/** Rótulos da tabela "Disciplinas em Curso" do portal (parser de horários). */
const PORTAL_DAY: Record<Day, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

const SLOT_ORDER = TIME_VALUES.map(time => time.periodAlias);

function slot(id: Turno) {
  const time = TIME_VALUES.find(value => value.periodAlias === id);
  if (!time) throw new Error(`Tempo desconhecido: ${id}`);
  return time;
}

function slotsBetween(from: Turno, to: Turno): Turno[] {
  return SLOT_ORDER.slice(
    SLOT_ORDER.indexOf(from),
    SLOT_ORDER.indexOf(to) + 1,
  ) as Turno[];
}

/** Um objeto por dia, como `parseHorarioArray` devolve. */
function horario(meetings: readonly Meeting[]): Horario[] {
  return meetings.map(meeting => ({
    [WEEKDAY[meeting.day]]: [slotsBetween(meeting.from, meeting.to)],
  }));
}

/* ------------------------------------------- disciplinas em curso 2026.2 */

const LOC = {
  F6037: 'Pav. João Lyra Filho · 6º andar · Sala 6037 F',
  D6113: 'Pav. João Lyra Filho · 6º andar · Sala 6113 D',
  B6019: 'Pav. João Lyra Filho · 6º andar · Sala 6019 B',
  LAB: 'Pav. João Lyra Filho · 6º andar · Laboratório LIG',
  /** O portal escreve isso quando a sala ainda não foi definida. */
  NOT_INFORMED: 'Não Informado',
};

type Enrolled = {
  id: string;
  name: string;
  class: string;
  uerjLocation?: string;
  avaLocation?: string;
  status: 'ACTIVE' | 'CANCELED';
  meetings: Meeting[];
  teacher: string;
};

const ENROLLED: Enrolled[] = [
  {
    id: 'IME04-10933',
    name: 'Otimização Combinatória',
    class: '1',
    uerjLocation: LOC.B6019,
    status: 'ACTIVE',
    meetings: [
      { day: 2, from: 'T1', to: 'T2' },
      { day: 4, from: 'T1', to: 'T2' },
    ],
    teacher: 'Cláudia Ventura',
  },
  {
    id: 'IME02-10871',
    name: 'Compiladores',
    class: '1',
    uerjLocation: LOC.D6113,
    // Sala virtual do AVA, além da sala física.
    avaLocation: 'SALA12IMECOMP',
    status: 'ACTIVE',
    meetings: [
      { day: 2, from: 'M3', to: 'M4' },
      { day: 4, from: 'M3', to: 'M4' },
    ],
    teacher: 'Fernando Lisboa Reis',
  },
  {
    id: 'IME02-10892',
    name: 'Sistemas Distribuídos',
    class: '2',
    uerjLocation: LOC.F6037,
    status: 'ACTIVE',
    meetings: [
      { day: 1, from: 'T3', to: 'T4' },
      { day: 3, from: 'T3', to: 'T4' },
    ],
    teacher: 'Helena Duarte Viana',
  },
  {
    id: 'IME02-11024',
    name: 'Aprendizado de Máquina',
    class: '1',
    uerjLocation: LOC.LAB,
    status: 'ACTIVE',
    meetings: [
      { day: 1, from: 'N1', to: 'N2' },
      { day: 3, from: 'N1', to: 'N2' },
    ],
    teacher: 'Marcos Teles',
  },
  {
    id: 'IME02-10905',
    name: 'Ética e Computação',
    class: '3',
    uerjLocation: LOC.NOT_INFORMED,
    status: 'ACTIVE',
    meetings: [{ day: 5, from: 'M5', to: 'M6' }],
    teacher: 'Lívia Moraes Prado',
  },
  {
    id: 'IME02-10950',
    name: 'Projeto Final I',
    class: '1',
    uerjLocation: LOC.F6037,
    status: 'ACTIVE',
    meetings: [{ day: 5, from: 'T3', to: 'T4' }],
    teacher: 'Paulo César Antunes',
  },
  {
    // Inscrição cancelada. O protótipo não lhe dá encontros; aqui ela ocupa o
    // sábado (dia sem aulas no protótipo) para que "Disciplinas em curso"
    // exiba o rótulo "Cancelada" sem alterar os dias úteis da referência.
    id: 'IME02-10880',
    name: 'Computação Gráfica',
    class: '1',
    status: 'CANCELED',
    meetings: [{ day: 6, from: 'M3', to: 'M4' }],
    teacher: 'Ana Beatriz Coelho',
  },
];

function attendedInfo(subject: Enrolled): AttendedSubjectInfo {
  // Como o parser: campos vazios ficam ausentes e canceladas não têm sala.
  return {
    id: subject.id,
    name: subject.name,
    class: subject.class,
    status: subject.status,
    avaLocation: subject.avaLocation,
    uerjLocation:
      subject.status === 'CANCELED' ? undefined : subject.uerjLocation,
  } as AttendedSubjectInfo;
}

export const SCHEDULE: AttendedClassesSchedule[] = ENROLLED.flatMap(subject =>
  subject.meetings.map(meeting => {
    const start = slot(meeting.from);
    const end = slot(meeting.to);
    return {
      class: attendedInfo(subject),
      dayAlias: PORTAL_DAY[meeting.day],
      dayNumber: meeting.day,
      subject_id: subject.id,
      periodAlias: start.periodAlias,
      startTimeAlias: start.startTimeAlias,
      endTimeAlias: end.endTimeAlias,
      start_time_in_minutes: start.start_time_in_minutes,
      end_time_in_minutes: end.end_time_in_minutes,
    };
  }),
).sort(
  (a, b) =>
    a.dayNumber - b.dayNumber ||
    a.start_time_in_minutes - b.start_time_in_minutes,
);

/* --------------------------------------------------- quadro de notas */

export const GRADES: ClassGrade[] = [
  {
    id: 'IME02-10892',
    name: 'Sistemas Distribuídos',
    class: '2',
    grades: { p1: 8.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-11024',
    name: 'Aprendizado de Máquina',
    class: '1',
    grades: { p1: 9.2, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10871',
    name: 'Compiladores',
    class: '1',
    grades: { p1: 6, p2: null, pf: null, result: null },
  },
  {
    id: 'IME04-10933',
    name: 'Otimização Combinatória',
    class: '1',
    grades: { p1: 4.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10905',
    name: 'Ética e Computação',
    class: '3',
    grades: { p1: null, p2: null, pf: null, result: 9 },
  },
];

/* ------------------------------------------------------- RID parcial */

export const PARTIAL_RID: PartialRidResult = {
  updatedAt: '12/08/2026 14:32',
  subjects: [
    {
      id: 'IME02-10892',
      name: 'Sistemas Distribuídos',
      classNumber: '2',
      available: 40,
      requested: 38,
      position: 12,
      status: 'Deferida',
    },
    {
      id: 'IME04-10933',
      name: 'Otimização Combinatória',
      classNumber: '1',
      available: 35,
      requested: 30,
      position: 8,
      status: 'Deferida',
    },
    {
      id: 'IME02-10871',
      name: 'Compiladores',
      classNumber: '1',
      available: 45,
      requested: 52,
      position: 41,
      status: 'Em processamento',
    },
    {
      id: 'IME02-11024',
      name: 'Aprendizado de Máquina',
      classNumber: '1',
      available: 30,
      requested: 61,
      position: 27,
      status: 'Em processamento',
    },
    {
      id: 'IME02-10880',
      name: 'Computação Gráfica',
      classNumber: '1',
      available: 30,
      requested: 44,
      position: 0,
      status: 'Indeferida: choque de horário',
    },
  ],
};

/* ---------------------------------------------------------- currículo */

type CurriculumSeed = [
  id: string,
  name: string,
  period: number | null,
  type: CurriculumSubject['type'],
  credits: number,
  workload: number,
  extra?: { branch?: string; minimum_credits?: number },
];

const CURRICULUM_SEED: CurriculumSeed[] = [
  ['IME01-10012', 'Cálculo Diferencial e Integral I', 1, 'MANDATORY', 6, 90],
  ['IME01-10015', 'Geometria Analítica', 1, 'MANDATORY', 4, 60],
  ['IME02-10801', 'Matemática Discreta', 1, 'MANDATORY', 4, 60],
  ['IME02-10802', 'Fundamentos da Computação', 1, 'MANDATORY', 4, 60],
  ['IME02-10803', 'Linguagem de Programação I', 1, 'MANDATORY', 4, 75],
  ['IME01-10022', 'Cálculo Diferencial e Integral II', 2, 'MANDATORY', 6, 90],
  ['IME01-10031', 'Álgebra Linear', 2, 'MANDATORY', 4, 60],
  ['FIS01-10120', 'Física I', 2, 'MANDATORY', 4, 75],
  ['IME02-10811', 'Linguagem de Programação II', 2, 'MANDATORY', 4, 75],
  ['IME02-10812', 'Estruturas de Dados I', 2, 'MANDATORY', 4, 60],
  ['IME01-10041', 'Cálculo Diferencial e Integral III', 3, 'MANDATORY', 4, 60],
  ['IME03-10210', 'Probabilidade e Estatística', 3, 'MANDATORY', 4, 60],
  ['IME02-10821', 'Estruturas de Dados II', 3, 'MANDATORY', 4, 60],
  ['IME02-10822', 'Arquitetura de Computadores I', 3, 'MANDATORY', 4, 60],
  ['IME02-10823', 'Lógica para Computação', 3, 'MANDATORY', 4, 60],
  ['IME04-10901', 'Cálculo Numérico', 4, 'MANDATORY', 4, 60],
  ['IME02-10841', 'Teoria dos Grafos', 4, 'MANDATORY', 4, 60],
  ['IME02-10842', 'Banco de Dados I', 4, 'MANDATORY', 4, 60],
  ['IME02-10843', 'Arquitetura de Computadores II', 4, 'MANDATORY', 4, 60],
  ['IME02-10844', 'Linguagens Formais e Autômatos', 4, 'MANDATORY', 4, 60],
  ['IME02-10838', 'Engenharia de Software', 5, 'MANDATORY', 4, 60],
  ['IME02-10860', 'Sistemas Operacionais I', 5, 'MANDATORY', 4, 60],
  ['IME02-10862', 'Redes de Computadores I', 5, 'MANDATORY', 4, 60],
  ['IME02-10863', 'Banco de Dados II', 5, 'MANDATORY', 4, 60],
  ['IME02-10864', 'Análise de Algoritmos', 5, 'MANDATORY', 4, 60],
  ['IME02-10871', 'Compiladores', 6, 'MANDATORY', 4, 60],
  ['IME02-10872', 'Inteligência Artificial', 6, 'MANDATORY', 4, 60],
  ['IME02-10873', 'Sistemas Operacionais II', 6, 'MANDATORY', 4, 60],
  ['IME02-10874', 'Interação Humano-Computador', 6, 'MANDATORY', 4, 60],
  ['IME02-10880', 'Computação Gráfica', 6, 'MANDATORY', 4, 60],
  ['IME02-10892', 'Sistemas Distribuídos', 7, 'MANDATORY', 4, 60],
  ['IME04-10933', 'Otimização Combinatória', 7, 'MANDATORY', 4, 60],
  ['IME02-10905', 'Ética e Computação', 7, 'MANDATORY', 2, 30],
  [
    'IME02-10950',
    'Projeto Final I',
    7,
    'MANDATORY',
    4,
    60,
    { minimum_credits: 140 },
  ],
  [
    'IME02-10951',
    'Projeto Final II',
    8,
    'MANDATORY',
    4,
    60,
    { minimum_credits: 150 },
  ],
  [
    'IME02-10960',
    'Estágio Supervisionado',
    8,
    'MANDATORY',
    6,
    180,
    { minimum_credits: 120 },
  ],
  [
    'IME02-11024',
    'Aprendizado de Máquina',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'A' },
  ],
  [
    'IME02-11025',
    'Processamento de Imagens',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'A' },
  ],
  [
    'IME02-11031',
    'Segurança da Informação',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'B' },
  ],
  [
    'IME02-11032',
    'Computação em Nuvem',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'B' },
  ],
  [
    'IME02-11040',
    'Desenvolvimento para Dispositivos Móveis',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'C' },
  ],
  [
    'IME02-11041',
    'Visão Computacional',
    null,
    'RESTRICTED',
    4,
    60,
    { branch: 'A' },
  ],
  ['IME03-10260', 'Inferência Estatística', null, 'DEFINED', 4, 60],
  ['ILE02-10115', 'Inglês Instrumental', null, 'DEFINED', 2, 30],
  ['ICS01-10230', 'Empreendedorismo e Inovação', null, 'DEFINED', 2, 30],
  ['IFC03-10440', 'Filosofia da Ciência', null, 'DEFINED', 4, 60],
];

/* ------------------------------------------------------------ universais */

/** Departamentos vêm do prefixo do código, como na tela de Universais. */
export const UNIVERSALS: UniversalSubject[] = (
  [
    ['ILE01-10301', 'Língua Brasileira de Sinais (Libras)', 2, 30],
    ['ILE01-10322', 'Leitura e Produção de Textos Acadêmicos', 4, 60],
    ['EDU03-10118', 'Educação e Diversidade', 4, 60],
    ['EDU05-10204', 'Tecnologias Digitais na Educação', 2, 30],
    ['IFC02-10507', 'História do Rio de Janeiro', 4, 60],
    ['IFC04-10612', 'Introdução à Antropologia', 4, 60],
    ['FCE01-10077', 'Introdução à Economia', 4, 60],
    ['FCE02-10093', 'Finanças Pessoais', 2, 30],
    ['IART01-10150', 'Fotografia e Imagem', 4, 60],
    ['IART02-10188', 'Música Popular Brasileira', 2, 30],
    ['IBRAG01-10044', 'Biologia e Sociedade', 2, 30],
  ] as const
).map(([id, name, credits, workload]) => ({
  id,
  name,
  type: 'UNIVERSAL' as const,
  credits,
  workload,
  subjectOfPeriod: true,
}));

/* ----------------------------------------------------------- histórico */

type HistorySeed = [
  period: string,
  id: string,
  status: SubjectsTaken['status'],
  grade: number | null,
  frequency: number | null,
];

const HISTORY_SEED: HistorySeed[] = [
  ['2023.1', 'IME01-10012', 'APPROVED', 7, 92],
  ['2023.1', 'IME01-10015', 'APPROVED', 8.4, 96],
  ['2023.1', 'IME02-10801', 'APPROVED', 7.8, 90],
  ['2023.1', 'IME02-10802', 'APPROVED', 9.1, 100],
  ['2023.1', 'IME02-10803', 'APPROVED', 9.6, 100],

  ['2023.2', 'IME01-10022', 'FAILED_BY_GRADE', 3.8, 88],
  ['2023.2', 'IME01-10031', 'APPROVED', 6.9, 86],
  ['2023.2', 'FIS01-10120', 'FAILED_BY_ATTENDANCE', 2, 58],
  ['2023.2', 'IME02-10811', 'APPROVED', 8.8, 94],
  ['2023.2', 'IME02-10812', 'APPROVED', 8.2, 92],

  ['2024.1', 'IME01-10022', 'APPROVED', 6.4, 90],
  ['2024.1', 'FIS01-10120', 'APPROVED', 7.1, 84],
  ['2024.1', 'IME03-10210', 'APPROVED', 7.6, 88],
  ['2024.1', 'IME02-10821', 'APPROVED', 8.7, 96],
  ['2024.1', 'IME02-10823', 'APPROVED', 9, 100],

  ['2024.2', 'IME01-10041', 'APPROVED', 6.2, 82],
  ['2024.2', 'IME02-10822', 'APPROVED', 7.9, 90],
  ['2024.2', 'IME02-10841', 'APPROVED', 8.5, 94],
  ['2024.2', 'IME02-10842', 'APPROVED', 9.3, 98],
  ['2024.2', 'ILE01-10301', 'APPROVED', 9.5, 100],

  ['2025.1', 'IME04-10901', 'APPROVED', 7.3, 88],
  ['2025.1', 'IME02-10843', 'APPROVED', 8.1, 92],
  ['2025.1', 'IME02-10844', 'APPROVED', 7.7, 90],
  ['2025.1', 'IME02-10838', 'APPROVED', 9.4, 100],
  ['2025.1', 'IME03-10260', 'CANCELED', null, null],

  ['2025.2', 'IME02-10860', 'APPROVED', 8, 92],
  ['2025.2', 'IME02-10862', 'APPROVED', 8.6, 96],
  ['2025.2', 'IME02-10863', 'APPROVED', 8.9, 94],
  ['2025.2', 'IME02-10864', 'APPROVED', 7.2, 86],
  ['2025.2', 'ILE02-10115', 'APPROVED', 9.8, 100],

  ['2026.1', 'IME02-10872', 'APPROVED', 8.8, 96],
  ['2026.1', 'IME02-10873', 'APPROVED', 7.5, 90],
  ['2026.1', 'IME02-10874', 'APPROVED', 9.2, 100],
  ['2026.1', 'IME02-11031', 'APPROVED', 8.3, 92],
  ['2026.1', 'ICS01-10230', 'APPROVED', 9, 96],

  ['2026.2', 'IME02-10892', 'IN_PROGRESS', null, null],
  ['2026.2', 'IME04-10933', 'IN_PROGRESS', null, null],
  ['2026.2', 'IME02-10871', 'IN_PROGRESS', null, null],
  ['2026.2', 'IME02-11024', 'IN_PROGRESS', null, null],
  ['2026.2', 'IME02-10905', 'IN_PROGRESS', null, null],
  ['2026.2', 'IME02-10950', 'IN_PROGRESS', null, null],
];

function catalogEntry(id: string) {
  const fromCurriculum = CURRICULUM_SEED.find(seed => seed[0] === id);
  if (fromCurriculum) {
    const [, name, , type, credits, workload] = fromCurriculum;
    return { name, type, credits, workload };
  }
  const universal = UNIVERSALS.find(subject => subject.id === id);
  if (universal)
    return {
      name: universal.name,
      type: universal.type,
      credits: universal.credits ?? 0,
      workload: universal.workload ?? 0,
    };
  throw new Error(`Disciplina fictícia desconhecida: ${id}`);
}

export const HISTORY: SubjectsTaken[] = HISTORY_SEED.map(
  ([period, id, status, grade, frequency]) => {
    const { name, type, credits, workload } = catalogEntry(id);
    return {
      period,
      id,
      name,
      type,
      credits,
      workload,
      status,
      grade,
      frequency,
    };
  },
);

const approvedIds = new Set(
  HISTORY.filter(
    subject => subject.status === 'APPROVED' || subject.status === 'EXEMPT',
  ).map(subject => subject.id),
);

/* --------------------------------------------- detalhes de disciplinas */

type ClassSeed = {
  classNumber: number;
  meetings: Meeting[];
  teachers: string[];
  location?: string;
  hasPreference?: boolean;
  /** [solicitadas ocupadas, solicitadas oferecidas, ocupadas, oferecidas] */
  vacancies?: [number, number, number, number];
};

function subjectClass(seed: ClassSeed): SubjectClassesSchedule {
  const [requestedTaken, requestedAvailable, taken, available] =
    seed.vacancies ?? [18, 40, 16, 40];
  return {
    classNumber: seed.classNumber,
    hasPreference: seed.hasPreference ?? false,
    location: seed.location ?? LOC.F6037,
    schedule: horario(seed.meetings),
    teachers: seed.teachers,
    vacancies: {
      uerj: {
        available,
        taken,
        requestedAvailable,
        requestedTaken,
        preferential: 0,
      },
      freshman: {
        available: 0,
        taken: 0,
        requestedAvailable: 0,
        requestedTaken: 0,
        preferential: 0,
      },
    },
  };
}

/** Turmas explícitas do protótipo (pesquisa e passos 5–6 do gerador). */
const CLASS_SEEDS: Record<string, ClassSeed[]> = {
  'IME02-10892': [
    {
      classNumber: 1,
      hasPreference: true,
      teachers: ['Ricardo Moura Lemos'],
      location: LOC.D6113,
      vacancies: [38, 40, 36, 40],
      meetings: [
        { day: 1, from: 'M3', to: 'M4' },
        { day: 3, from: 'M3', to: 'M4' },
      ],
    },
    {
      classNumber: 2,
      teachers: ['Helena Duarte Viana'],
      location: LOC.F6037,
      vacancies: [22, 40, 20, 40],
      meetings: [
        { day: 1, from: 'T3', to: 'T4' },
        { day: 3, from: 'T3', to: 'T4' },
      ],
    },
    {
      classNumber: 3,
      teachers: ['Paulo César Antunes', 'Lívia Moraes Prado'],
      location: LOC.B6019,
      vacancies: [40, 40, 40, 40],
      meetings: [
        { day: 2, from: 'N1', to: 'N2' },
        { day: 4, from: 'N1', to: 'N2' },
      ],
    },
  ],
  'IME02-10880': [
    {
      classNumber: 1,
      teachers: ['Ana Beatriz Coelho'],
      meetings: [
        { day: 1, from: 'M3', to: 'M4' },
        { day: 3, from: 'M3', to: 'M4' },
      ],
    },
    {
      classNumber: 2,
      teachers: ['Ana Beatriz Coelho'],
      meetings: [
        { day: 2, from: 'N1', to: 'N2' },
        { day: 4, from: 'N1', to: 'N2' },
      ],
    },
  ],
  'IME02-11025': [
    {
      classNumber: 1,
      teachers: ['Fernando Lisboa Reis'],
      meetings: [
        { day: 1, from: 'T1', to: 'T2' },
        { day: 3, from: 'T1', to: 'T2' },
      ],
    },
  ],
  'IME02-11032': [
    {
      classNumber: 1,
      teachers: ['Ricardo Moura Lemos'],
      meetings: [{ day: 5, from: 'M1', to: 'M4' }],
    },
  ],
  'IME02-11040': [
    {
      classNumber: 1,
      teachers: ['Juliana Prates', 'Otávio Saldanha'],
      meetings: [
        { day: 2, from: 'M3', to: 'M4' },
        { day: 4, from: 'M3', to: 'M4' },
      ],
    },
  ],
  'IME03-10260': [
    {
      classNumber: 1,
      teachers: ['Cláudia Ventura'],
      meetings: [
        { day: 1, from: 'N1', to: 'N2' },
        { day: 3, from: 'N1', to: 'N2' },
      ],
    },
    {
      classNumber: 2,
      teachers: ['Marcos Teles'],
      meetings: [
        { day: 2, from: 'T1', to: 'T2' },
        { day: 4, from: 'T1', to: 'T2' },
      ],
    },
  ],
  'IME02-10951': [
    {
      classNumber: 1,
      teachers: ['Paulo César Antunes'],
      meetings: [{ day: 5, from: 'T3', to: 'T4' }],
    },
  ],
};

const PREREQUISITES: Record<string, Prereq[][]> = {
  'IME02-10892': [
    [{ id: 'IME02-10860', name: 'Sistemas Operacionais I' }],
    [{ id: 'IME02-10862', name: 'Redes de Computadores I' }],
  ],
  'IME02-10951': [[{ id: 'IME02-10950', name: 'Projeto Final I' }]],
  'IME02-10871': [
    [{ id: 'IME02-10844', name: 'Linguagens Formais e Autômatos' }],
  ],
  'IME02-11025': [
    [
      { id: 'IME02-10812', name: 'Estruturas de Dados I' },
      { id: 'IME02-10811', name: 'Linguagem de Programação II' },
    ],
  ],
};

const TEACHER_POOL = [
  'Ricardo Moura Lemos',
  'Helena Duarte Viana',
  'Paulo César Antunes',
  'Lívia Moraes Prado',
  'Ana Beatriz Coelho',
  'Fernando Lisboa Reis',
  'Juliana Prates',
  'Cláudia Ventura',
  'Marcos Teles',
];

const BLOCKS: [Turno, Turno][] = [
  ['M1', 'M2'],
  ['M3', 'M4'],
  ['M5', 'M6'],
  ['T1', 'T2'],
  ['T3', 'T4'],
  ['T5', 'T6'],
  ['N1', 'N2'],
  ['N3', 'N4'],
];

function numericCode(id: string) {
  return Number(id.split('-').pop());
}

/** Turma única e determinística para disciplinas sem turmas explícitas. */
function fallbackClasses(id: string): ClassSeed[] {
  const code = numericCode(id);
  const day = ((code % 3) + 1) as Day;
  const [from, to] = BLOCKS[code % BLOCKS.length];
  return [
    {
      classNumber: 1,
      teachers: [TEACHER_POOL[code % TEACHER_POOL.length]],
      meetings: [
        { day, from, to },
        { day: (day + 2) as Day, from, to },
      ],
    },
  ];
}

function classSeedsFor(id: string): ClassSeed[] {
  const explicit = CLASS_SEEDS[id];
  if (explicit) return explicit;
  const enrolled = ENROLLED.find(subject => subject.id === id);
  if (enrolled && enrolled.status === 'ACTIVE')
    return [
      {
        classNumber: Number(enrolled.class),
        teachers: [enrolled.teacher],
        location: enrolled.uerjLocation,
        meetings: enrolled.meetings,
      },
    ];
  return fallbackClasses(id);
}

/** Every subject that can be searched in demo mode. */
export const CATALOG_IDS: string[] = [
  ...CURRICULUM_SEED.map(seed => seed[0]),
  ...UNIVERSALS.map(subject => subject.id),
];

export function findSubjectDetails(numericId: string): SubjectInfo | null {
  const id = CATALOG_IDS.find(
    candidate => numericCode(candidate) === Number(numericId),
  );
  if (!id) return null;
  const { name, credits, workload } = catalogEntry(id);
  const classes = classSeedsFor(id);
  return {
    id,
    code: numericCode(id),
    name,
    credits,
    workload,
    timesPerWeek: classes[0]?.meetings.length ?? 0,
    universal: UNIVERSALS.some(subject => subject.id === id),
    conflito: false,
    preparo: false,
    approvation_type: 'Nota e Frequência',
    duration: 'Semestral',
    prerequisite: PREREQUISITES[id] ?? [],
    classes: classes.map(subjectClass),
  };
}

export const CURRICULUM: CurriculumSubject[] = CURRICULUM_SEED.map(
  ([id, name, period, type, credits, workload, extra]) => ({
    id,
    name,
    period,
    alreadyTaken: approvedIds.has(id),
    type,
    branch: extra?.branch ?? '',
    credits,
    workload,
    minimum_credits: extra?.minimum_credits ?? null,
    // "Período atual" no portal: oferecida no período corrente.
    subjectOfPeriod: Boolean(CLASS_SEEDS[id]),
  }),
);

/* ------------------------------------------------------------ docentes */

export function demoTeachers(): Teacher[] {
  const byName = new Map<string, Teacher>();
  CATALOG_IDS.forEach(id => {
    const details = findSubjectDetails(String(numericCode(id)));
    details?.classes?.forEach(group =>
      group.teachers?.forEach(name => {
        const teacher = byName.get(name) ?? {
          id: `demo-${byName.size + 1}`,
          name,
          updatedAt: '2026-08-12T17:32:00.000Z',
          subjects: [],
        };
        let subject = teacher.subjects.find(item => item.id === id);
        if (!subject) {
          subject = { id, name: details.name ?? id, classes: [] };
          teacher.subjects.push(subject);
        }
        subject.classes.push({
          number: String(group.classNumber ?? ''),
          location: group.location ?? '',
        });
        byName.set(name, teacher);
      }),
    );
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------- mural */

/** Data e hora de Brasília (UTC−3) em ISO, como a API do mural devolve. */
function brasilia(date: string, time: string) {
  const [day, month, year] = date.split('/').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour + 3, minute),
  ).toISOString();
}

type MessageSeed = [author: string, date: string, time: string, text: string];

const SD_THREAD = {
  subjectId: 'IME02-10892',
  classNumber: '2',
  period: '2026.2',
};

const SD_MESSAGES: MessageSeed[] = [
  [
    'Lucas Ferreira',
    '09/10/2026',
    '21:14',
    'Galera, criei o grupo da turma 2: https://chat.whatsapp.com/exemplo-turma2',
  ],
  [
    'Beatriz Nunes',
    '10/10/2026',
    '08:02',
    'A professora confirmou a P2 para 24/11, mesma sala.',
  ],
  [
    // Mensagem "minha": mesmo nome do perfil de demonstração.
    DEMO_STUDENT.name,
    '10/10/2026',
    '08:15',
    'Alguém tem os slides da aula de consenso (Raft)? Perdi a de quarta.',
  ],
  [
    'Thiago Rocha',
    '10/10/2026',
    '09:40',
    'Subi na pasta da turma: https://drive.google.com/exemplo-sd',
  ],
  [
    'Beatriz Nunes',
    '12/10/2026',
    '19:22',
    'Lista 3 vale ponto extra se entregar até sexta.',
  ],
];

export function initialMessages(): Message[] {
  return SD_MESSAGES.map(([authorName, date, time, text], index) => ({
    id: `demo-message-${index + 1}`,
    authorName,
    ...SD_THREAD,
    text,
    createdAt: brasilia(date, time),
  }));
}
