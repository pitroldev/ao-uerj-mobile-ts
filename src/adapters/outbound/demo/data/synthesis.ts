/*
 * Síntese da Formação e atividades complementares. Os créditos cumpridos e o
 * CR saem do próprio histórico fictício, para as telas concordarem entre si.
 */
import type {
  ComplementaryActivities,
  GraduationSynthesis,
  SynthesisRequirement,
} from '@root/modules/academics/domain/models';
import type { DemoClock } from '../clock';
import { CATALOG, catalogEntry } from './catalog';
import { APPROVED_IDS, USED_PERIODS, history } from './history';

/** Créditos de eletivas que o currículo fictício exige. */
const ELECTIVES_REQUIRED = { RESTRICTED: 16, DEFINED: 8, UNIVERSAL: 4 };

const PERIODS = { minimum: 8, maximum: 12, extra: 0 };

function approvedCredits(type: string) {
  return [...APPROVED_IDS]
    .map(catalogEntry)
    .filter(entry => entry.type === type)
    .reduce((sum, entry) => sum + entry.credits, 0);
}

/** A média das tentativas com nota, ponderada pelos créditos, com 2 casas. */
function officialCr(clock: DemoClock) {
  let points = 0;
  let credits = 0;
  for (const subject of history(clock)) {
    if (subject.status === 'IN_PROGRESS' || subject.grade === null) continue;
    points += subject.grade * (subject.credits ?? 0);
    credits += subject.credits ?? 0;
  }
  return credits ? Number((points / credits).toFixed(2)) : null;
}

const COMPLEMENTARY = {
  label: 'Atividades Complementares',
  required: 200,
};

export function synthesis(clock: DemoClock): GraduationSynthesis {
  const mandatory = CATALOG.filter(entry => entry.type === 'MANDATORY').reduce(
    (sum, entry) => sum + entry.credits,
    0,
  );
  const elective = (
    kind: keyof typeof ELECTIVES_REQUIRED,
    label: string,
  ): SynthesisRequirement => ({
    kind,
    label,
    branch: null,
    done: approvedCredits(kind),
    required: ELECTIVES_REQUIRED[kind],
  });
  const electives = [
    elective('RESTRICTED', 'Grupo de Eletivas: Disciplinas Restritas'),
    elective(
      'DEFINED',
      'Eletivas Definidas (livre escolha entre as oferecidas para o curso)',
    ),
    elective(
      'UNIVERSAL',
      'Eletivas Universais (livre escolha entre as oferecidas pela universidade)',
    ),
  ];
  return {
    curriculumVersion: '1 - Currículo de Ciência da Computação (Demonstração)',
    regime: 'Crédito',
    cr: officialCr(clock),
    requirements: [
      {
        kind: 'MANDATORY',
        label: 'Grupo de Obrigatórias',
        branch: '1 - Ciência da Computação - Parte Comum',
        done: approvedCredits('MANDATORY'),
        required: mandatory,
      },
      ...electives,
      {
        kind: 'ELECTIVES',
        label: 'Total de Eletivas',
        done: electives.reduce((sum, item) => sum + (item.done ?? 0), 0),
        required: electives.reduce(
          (sum, item) => sum + (item.required ?? 0),
          0,
        ),
        branch: null,
      },
      {
        kind: 'OTHER',
        label: COMPLEMENTARY.label,
        branch: null,
        done: complementaryCounted(),
        required: COMPLEMENTARY.required,
      },
    ],
    periods: {
      minimum: PERIODS.minimum,
      used: USED_PERIODS,
      maximum: PERIODS.maximum,
      remaining: PERIODS.maximum + PERIODS.extra - USED_PERIODS,
      extra: PERIODS.extra,
    },
    currentPeriod: clock.period(),
  };
}

/* ------------------------------------------- atividades complementares */

type ActivitySeed = [
  back: number,
  type: string,
  hours: number,
  description: string,
];

const EXTENSION = 'Participação em cursos de extensão';
const TALKS = 'Assistir palestras e aulas inaugurais';
const TUTORING = 'Monitoria';
const EVENTS = 'Participação em eventos científicos';

const ACTIVITY_SEED: ActivitySeed[] = [
  [6, EXTENSION, 30, 'Oficina de programação competitiva'],
  [6, TALKS, 4, ''],
  [5, TALKS, 6, 'Aula inaugural do curso'],
  [4, TUTORING, 60, 'Monitoria de Estruturas de Dados I'],
  [3, EXTENSION, 40, 'Curso de introdução à robótica'],
  [1, EVENTS, 20, 'Semana Acadêmica do curso'],
];

/** "CH Máxima" de cada tipo: o que passa disso não conta. */
const MAXIMUM: Record<string, number> = {
  [EXTENSION]: 60,
  [TALKS]: 20,
  [TUTORING]: 60,
  [EVENTS]: 40,
};

function byType() {
  return Object.entries(MAXIMUM).map(([type, maximum]) => {
    const total = ACTIVITY_SEED.filter(([, kind]) => kind === type).reduce(
      (sum, [, , hours]) => sum + hours,
      0,
    );
    const counted = Math.min(total, maximum);
    return { type, maximum, counted, excess: total - counted, total };
  });
}

function complementaryCounted() {
  return byType().reduce((sum, item) => sum + item.counted, 0);
}

export function complementaryActivities(
  clock: DemoClock,
): ComplementaryActivities {
  return {
    // o parser repete o período nas linhas seguintes do mesmo
    activities: ACTIVITY_SEED.map(([back, type, hours, description]) => ({
      period: clock.period(back),
      type,
      hours,
      description,
    })),
    byType: byType(),
  };
}
