import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

import { renderWithProviders } from '@root/test-utils/render';
import { StepsProvider } from '@hooks/useSteps';
import {
  prerequisiteGraph,
  type PlanSubject,
} from '@root/modules/graduation/domain/plan';
import {
  assembleGeneration,
  type SubjectAvailability,
} from '@root/modules/planning/domain/availability';
import {
  GOALS,
  createGeneratorDraft,
  type GeneratorDraft,
  type ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import type {
  CurriculumSubject,
  SubjectInfo,
} from '@root/modules/academics/domain/models';

import { CriticalityProvider } from '../criticality/CriticalityProvider';
import { ResultsStep } from '../steps/ResultsStep';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPlan = jest.fn();
jest.mock('@root/modules/graduation/presentation/useGraduationPlan', () => ({
  useGraduationPlan: (options: { load: boolean }) => mockPlan(options),
}));

const mockGeneration = {
  isPending: false,
  isSuccess: false,
  data: undefined as unknown[] | undefined,
  error: null,
  variables: undefined as ScheduleCreationParams | undefined,
  mutate: jest.fn(),
};
jest.mock('@root/modules/planning/presentation/useGenerateSchedules', () => ({
  useGenerateSchedules: () => mockGeneration,
}));
// o hook de verdade puxa o AppServicesProvider, e com ele o NetInfo nativo
jest.mock('@root/modules/planning/presentation/useGeneratorRun', () => ({
  useGeneratorRunNote: () => () => undefined,
  useGeneratorRunStart: () => () => undefined,
}));
// o compartilhamento da grade também puxa o AppServicesProvider
jest.mock('@root/modules/academics/presentation/useScheduleSharing', () => ({
  useScheduleSharing: () => ({
    share: jest.fn(),
    exporting: false,
    SvgRenderer: () => null,
  }),
}));
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  ...jest.requireActual('@root/modules/delivery/presentation/DeliveryProvider'),
  useCanInvite: () => false,
}));

const mockCatalog = {
  availability: new Map<string, SubjectAvailability>(),
  loading: 0,
  failed: 0,
  retry: jest.fn(),
  history: { data: [] },
  curriculum: { data: undefined },
};
jest.mock('@root/modules/planning/presentation/usePlanningCatalog', () => ({
  usePlanningCatalog: () => mockCatalog,
}));

/* --------------------------------------------------------------- fixtures */

const pending = (
  key: string,
  prerequisites: string[][] | null,
): PlanSubject => ({
  key,
  id: `IME02-${key}`,
  name: `Disciplina ${key}`,
  credits: 4,
  workload: 60,
  kind: 'MANDATORY',
  recommendedPeriod: 5,
  minimumCredits: 0,
  prerequisites,
  placeholder: false,
});

// 10871 trava 10880 e, por tabela, 10950
const READ = [
  pending('10871', []),
  pending('10880', [['10871']]),
  pending('10950', [['10880']]),
];
const UNREAD = READ.map(item => ({ ...item, prerequisites: null }));

const retry = jest.fn();
const view = (
  subjects: PlanSubject[],
  changes: {
    status?: string;
    catalog?: Partial<{ done: number; total: number; stoppedBy: string }>;
  } = {},
) => ({
  status: changes.status ?? 'ready',
  plan: { graph: prerequisiteGraph(subjects, new Set()) },
  subjects,
  unread: subjects.filter(item => item.prerequisites === null),
  catalog: {
    done: 0,
    total: 0,
    failed: [],
    stoppedBy: null,
    retry,
    reload: jest.fn(),
    ...changes.catalog,
  },
});

const curriculum = (key: string): CurriculumSubject => ({
  id: `IME02-${key}`,
  name: `Disciplina ${key}`,
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
});
const details = (key: string, day: 'Segunda' | 'Terça'): SubjectInfo => ({
  id: `IME02-${key}`,
  name: `Disciplina ${key}`,
  classes: [
    {
      classNumber: 1,
      schedule: [{ [day]: [['M1', 'M2']] }],
      vacancies: { uerj: {}, freshman: {} },
    },
  ],
});
const CHOSEN = [curriculum('10871'), curriculum('10880')];
const ADVANCE = [...GOALS.ADVANCE];

/* ---------------------------------------------------------------- harness */

const steps = { nextStep: jest.fn(), prevStep: jest.fn(), setStep: jest.fn() };

function Harness({
  values,
  children,
}: {
  values: Partial<GeneratorDraft>;
  children: React.ReactNode;
}) {
  const form = useForm<GeneratorDraft>({
    defaultValues: { ...createGeneratorDraft(), ...values },
  });
  return (
    <FormProvider {...form}>
      <CriticalityProvider>
        <StepsProvider values={{ step: 2, ...steps }}>{children}</StepsProvider>
      </CriticalityProvider>
    </FormProvider>
  );
}

const renderResults = (values: Partial<GeneratorDraft> = {}) =>
  renderWithProviders(<ResultsStep />, {
    wrapper: ({ children }) => (
      <Harness values={{ selectedSubjects: CHOSEN, ...values }}>
        {children}
      </Harness>
    ),
  });

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  jest.useFakeTimers();
  user = userEvent.setup();
  mockPlan.mockReset();
  retry.mockReset();
  mockGeneration.mutate.mockReset();
  mockCatalog.availability = new Map<string, SubjectAvailability>([
    ['IME02-10871', { status: 'ready', details: details('10871', 'Segunda') }],
    ['IME02-10880', { status: 'ready', details: details('10880', 'Terça') }],
  ]);
});
afterEach(() => {
  jest.useRealTimers();
});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const openGoals = () => user.press(button(/^O que mais importa: /));

/* ------------------------------------------------------------------ tests */

describe('"Adiantar o curso" na folha do que mais importa', () => {
  // o hook de verdade memoriza o grafo; um novo a cada chamada nunca assentaria
  const answer =
    (stored: ReturnType<typeof view>, loading: ReturnType<typeof view>) =>
    ({ load }: { load: boolean }) =>
      load ? loading : stored;

  it('reads nothing with another goal, then offers to read the prerequisites and reads on request', async () => {
    mockPlan.mockImplementation(
      answer(
        view(UNREAD),
        view(UNREAD, { status: 'reading', catalog: { done: 1, total: 3 } }),
      ),
    );
    await renderResults();
    expect(mockPlan).not.toHaveBeenCalled();

    await openGoals();
    await user.press(screen.getByRole('radio', { name: /^Adiantar o curso/ }));
    expect(
      screen.getAllByText(
        /o app lê no Aluno Online os pré-requisitos das 3 obrigatórias que faltam/,
      ).length,
    ).toBeGreaterThan(0);

    await user.press(
      screen.getAllByRole('button', { name: 'Ler os pré-requisitos' })[0],
    );
    expect(mockPlan).toHaveBeenLastCalledWith({ load: true });
    expect(
      screen.getByText(/^Lendo os pré-requisitos: 1 de 3\. Pode seguir/),
    ).toBeOnTheScreen();
  });

  it('offers to retry when the reading stops', async () => {
    mockPlan.mockImplementation(
      answer(
        view(UNREAD),
        view([READ[0], ...UNREAD.slice(1)], {
          catalog: { done: 1, total: 3, stoppedBy: 'NETWORK' },
        }),
      ),
    );
    await renderResults({ priority: ADVANCE });
    await openGoals();
    await user.press(
      screen.getAllByRole('button', { name: 'Ler os pré-requisitos' })[0],
    );
    expect(
      screen.getAllByText(/^A leitura dos pré-requisitos parou/).length,
    ).toBeGreaterThan(0);

    await user.press(
      screen.getAllByRole('button', { name: 'Tentar novamente' })[0],
    );
    expect(retry).toHaveBeenCalled();
  });

  it('confirms when everything is read and explains when it cannot know', async () => {
    mockPlan.mockReturnValue(view(READ));
    await renderResults({ priority: ADVANCE });
    await openGoals();
    expect(screen.getByText(/^Pré-requisitos lidos/)).toBeOnTheScreen();
    await screen.unmount();

    mockPlan.mockReturnValue(view(READ, { status: 'error' }));
    await renderResults({ priority: ADVANCE });
    expect(
      screen.getByText(/esta prioridade não muda a ordem das grades/),
    ).toBeOnTheScreen();
  });
});

describe('"Adiantar o curso" ao gerar', () => {
  it('sends how many pending subjects each chosen one locks', async () => {
    mockPlan.mockReturnValue(view(READ));
    await renderResults({ priority: ADVANCE });
    expect(mockGeneration.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        priority: ADVANCE,
        criticality: { 'IME02-10871': 2, 'IME02-10880': 1 },
      }),
    );
  });

  it('warns that the schedules use what was read so far', async () => {
    mockPlan.mockReturnValue(
      view(READ, { status: 'reading', catalog: { done: 2, total: 3 } }),
    );
    await renderResults({ priority: ADVANCE });
    expect(
      screen.getByText(
        'Ainda lendo os pré-requisitos (2 de 3). Gerar agora usa o que já foi lido.',
      ),
    ).toBeOnTheScreen();
  });

  it('does not send the count with another goal', async () => {
    mockPlan.mockReturnValue(view(READ));
    await renderResults();
    expect(mockGeneration.mutate).toHaveBeenCalledWith(
      assembleGeneration({
        draft: { ...createGeneratorDraft(), selectedSubjects: CHOSEN },
        availability: mockCatalog.availability,
        history: [],
      }),
    );
    expect(mockPlan).not.toHaveBeenCalled();
  });
});
