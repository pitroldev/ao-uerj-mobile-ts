/*
 * As disciplinas que a demonstração conhece: o currículo do curso e as
 * universais do período, cada uma com duas ou três turmas na Pesquisa de
 * Disciplinas. Os nomes seguem o que `parseSubjectName` entrega (iniciais
 * maiúsculas, "e", "de" e "para" minúsculos, sem parênteses).
 */
import type {
  CurriculumSubject,
  Prereq,
  SubjectClassesSchedule,
  SubjectInfo,
  UniversalSubject,
} from '@root/modules/academics/domain/models';
import { ENROLLED } from './enrolled';
import { ROOMS, TEACHERS } from './student';
import { horario, type Day, type Meeting, type Slot } from './time';

type CurriculumSeed = [
  id: string,
  name: string,
  period: number | null,
  type: CurriculumSubject['type'],
  credits: number,
  workload: number,
  extra?: { branch?: string; minimumCredits?: number; offered?: false },
];

export const CURRICULUM_SEED: CurriculumSeed[] = [
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
  ['IME02-10874', 'Interação Humano Computador', 6, 'MANDATORY', 4, 60],
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
    { minimumCredits: 100 },
  ],
  [
    'IME02-10951',
    'Projeto Final II',
    8,
    'MANDATORY',
    4,
    60,
    { minimumCredits: 120 },
  ],
  [
    'IME02-10960',
    'Estágio Supervisionado',
    8,
    'MANDATORY',
    6,
    180,
    { minimumCredits: 100 },
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
    // fora da oferta deste período, como acontece no portal
    { branch: 'A', offered: false },
  ],
  ['IME03-10260', 'Inferência Estatística', null, 'DEFINED', 4, 60],
  ['ILE02-10115', 'Inglês Instrumental', null, 'DEFINED', 2, 30],
  ['ICS01-10230', 'Empreendedorismo e Inovação', null, 'DEFINED', 2, 30],
  [
    'IFC03-10440',
    'Filosofia da Ciência',
    null,
    'DEFINED',
    4,
    60,
    { offered: false },
  ],
];

/** Universais do período; o departamento vem do prefixo do código. */
export const UNIVERSALS: UniversalSubject[] = (
  [
    ['ILE01-10301', 'Língua Brasileira de Sinais', 2, 30],
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

export type CatalogEntry = {
  id: string;
  name: string;
  type: CurriculumSubject['type'];
  credits: number;
  workload: number;
  offered: boolean;
};

export const CATALOG: CatalogEntry[] = [
  ...CURRICULUM_SEED.map(
    ([id, name, , type, credits, workload, extra]): CatalogEntry => ({
      id,
      name,
      type,
      credits,
      workload,
      offered: extra?.offered !== false,
    }),
  ),
  ...UNIVERSALS.map((subject): CatalogEntry => ({
    id: subject.id,
    name: subject.name,
    type: 'UNIVERSAL',
    credits: subject.credits ?? 0,
    workload: subject.workload ?? 0,
    offered: true,
  })),
];

/** O código numérico ("IME02-10871" → 10871), que o portal também aceita. */
export function numericCode(id: string): number {
  return Number(id.split('-').pop());
}

export function catalogEntry(id: string): CatalogEntry {
  const entry = CATALOG.find(item => item.id === id);
  if (!entry) throw new Error(`Disciplina fictícia desconhecida: ${id}`);
  return entry;
}

/* ------------------------------------------------- pré-requisitos */

const PREREQUISITES: Record<string, Prereq[][]> = {
  'IME01-10022': [
    [{ id: 'IME01-10012', name: 'Cálculo Diferencial e Integral I' }],
  ],
  'IME01-10041': [
    [{ id: 'IME01-10022', name: 'Cálculo Diferencial e Integral II' }],
  ],
  'IME02-10811': [[{ id: 'IME02-10803', name: 'Linguagem de Programação I' }]],
  'IME02-10812': [[{ id: 'IME02-10803', name: 'Linguagem de Programação I' }]],
  'IME02-10821': [[{ id: 'IME02-10812', name: 'Estruturas de Dados I' }]],
  'IME02-10864': [[{ id: 'IME02-10821', name: 'Estruturas de Dados II' }]],
  'IME02-10871': [
    [{ id: 'IME02-10844', name: 'Linguagens Formais e Autômatos' }],
  ],
  'IME02-10880': [
    [
      { id: 'IME01-10031', name: 'Álgebra Linear' },
      { id: 'IME01-10015', name: 'Geometria Analítica' },
    ],
    [{ id: 'IME02-10821', name: 'Estruturas de Dados II' }],
  ],
  'IME02-10892': [
    [{ id: 'IME02-10860', name: 'Sistemas Operacionais I' }],
    [{ id: 'IME02-10862', name: 'Redes de Computadores I' }],
  ],
  'IME02-10951': [[{ id: 'IME02-10950', name: 'Projeto Final I' }]],
  'IME02-11024': [[{ id: 'IME03-10210', name: 'Probabilidade e Estatística' }]],
  'IME02-11025': [
    [
      { id: 'IME02-10812', name: 'Estruturas de Dados I' },
      { id: 'IME02-10811', name: 'Linguagem de Programação II' },
    ],
  ],
};

/* --------------------------------------------------------- turmas */

type ClassSeed = {
  classNumber: number;
  meetings: Meeting[];
  teachers: string[];
  location: string;
  hasPreference: boolean;
  vacancies: { available: number; taken: number; requested: number };
};

const BLOCKS: [Slot, Slot][] = [
  ['M1', 'M2'],
  ['M3', 'M4'],
  ['M5', 'M6'],
  ['T1', 'T2'],
  ['T3', 'T4'],
  ['T5', 'T6'],
  ['N1', 'N2'],
  ['N3', 'N4'],
];

/** Pares de dias das turmas geradas: seg/qua, ter/qui e qua/sex. */
const DAY_PAIRS: [Day, Day][] = [
  [1, 3],
  [2, 4],
  [3, 5],
];

const ROOM_LIST = Object.values(ROOMS);

/** Uma turma determinística, do código e do número da turma. */
function generatedClass(entry: CatalogEntry, classNumber: number): ClassSeed {
  const code = numericCode(entry.id);
  const seed = code + classNumber * 7;
  const [from, to] = BLOCKS[seed % BLOCKS.length];
  const [first, second] = DAY_PAIRS[seed % DAY_PAIRS.length];
  // 30 h: um encontro por semana; o resto, dois
  const meetings: Meeting[] =
    entry.workload <= 30
      ? [{ day: first, from, to }]
      : [
          { day: first, from, to },
          { day: second, from, to },
        ];
  const available = 30 + (seed % 3) * 5;
  return {
    classNumber,
    meetings,
    teachers: [TEACHERS[seed % TEACHERS.length]],
    location: ROOM_LIST[seed % ROOM_LIST.length],
    hasPreference: classNumber === 1 && code % 2 === 0,
    vacancies: {
      available,
      taken: Math.min(available, 12 + (seed % 19)),
      requested: 14 + (seed % 23),
    },
  };
}

function classSeeds(entry: CatalogEntry): ClassSeed[] {
  const enrolled = ENROLLED.find(item => item.id === entry.id);
  const own = enrolled ? Number(enrolled.class) : 0;
  const count = Math.max(2 + (numericCode(entry.id) % 2), own);
  return Array.from({ length: count }, (_, index) => {
    const classNumber = index + 1;
    const generated = generatedClass(entry, classNumber);
    // a turma do aluno é a da grade: mesmos dias, sala e professor
    return enrolled && classNumber === own
      ? {
          ...generated,
          meetings: enrolled.meetings,
          teachers: [enrolled.teacher],
          location: enrolled.uerjLocation,
        }
      : generated;
  });
}

function subjectClass(seed: ClassSeed): SubjectClassesSchedule {
  const { available, taken, requested } = seed.vacancies;
  return {
    classNumber: seed.classNumber,
    hasPreference: seed.hasPreference,
    location: seed.location,
    schedule: horario(seed.meetings),
    teachers: seed.teachers,
    vacancies: {
      uerj: {
        available,
        taken,
        requestedAvailable: available,
        requestedTaken: Math.min(available, requested),
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

/**
 * A página de uma disciplina na Pesquisa de Disciplinas. Aceita o código
 * inteiro ("IME02-10871") ou só o número ("10871"), como o adaptador real;
 * `null` para um código que a demonstração não tem.
 */
export function subjectDetails(subjectId: string | number): SubjectInfo | null {
  const wanted = numericCode(String(subjectId).trim());
  if (!Number.isFinite(wanted)) return null;
  const entry = CATALOG.find(item => numericCode(item.id) === wanted);
  if (!entry) return null;
  const classes = entry.offered ? classSeeds(entry) : [];
  return {
    id: entry.id,
    code: numericCode(entry.id),
    name: entry.name,
    credits: entry.credits,
    workload: entry.workload,
    timesPerWeek: classes[0]?.meetings.length ?? 0,
    universal: entry.type === 'UNIVERSAL',
    conflito: false,
    preparo: false,
    approvation_type: 'Nota e Frequência',
    duration: 'Semestral',
    prerequisite: PREREQUISITES[entry.id] ?? [],
    classes: classes.map(subjectClass),
  };
}
