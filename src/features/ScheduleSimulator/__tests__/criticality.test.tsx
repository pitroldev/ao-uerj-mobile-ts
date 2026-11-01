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
  createScheduleDraft,
  type ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import type { SubjectInfo } from '@root/modules/academics/domain/models';

import { CriticalityProvider } from '../criticality/CriticalityProvider';
import { PriorityStep } from '../steps/PriorityStep';
import { GenerationStep } from '../steps/GenerationStep';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPlan = jest.fn();
jest.mock('@root/modules/graduation/presentation/useGraduationPlan', () => ({
  useGraduationPlan: (options: { load: boolean }) => mockPlan(options),
}));

const mockGeneration = {
  isIdle: true,
  isPending: false,
  isSuccess: false,
  data: undefined,
  error: null,
  mutate: jest.fn(),
};
jest.mock('@root/modules/planning/presentation/useGenerateSchedules', () => ({
  useGenerateSchedules: () => mockGeneration,
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

const details = (key: string): SubjectInfo => ({
  id: `IME02-${key}`,
  name: `Disciplina ${key}`,
  classes: [],
});

/* ---------------------------------------------------------------- harness */

const steps = { nextStep: jest.fn(), prevStep: jest.fn(), setStep: jest.fn() };

function Harness({
  step,
  values,
  children,
}: {
  step: number;
  values: Partial<ScheduleCreationParams>;
  children: React.ReactNode;
}) {
  const form = useForm<ScheduleCreationParams>({
    defaultValues: { ...createScheduleDraft(), ...values },
  });
  return (
    <FormProvider {...form}>
      <CriticalityProvider>
        <StepsProvider values={{ step, ...steps }}>{children}</StepsProvider>
      </CriticalityProvider>
    </FormProvider>
  );
}

const renderStep = (
  node: React.ReactElement,
  step: number,
  values: Partial<ScheduleCreationParams> = {},
) =>
  renderWithProviders(node, {
    wrapper: ({ children }) => (
      <Harness step={step} values={values}>
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
});
afterEach(() => {
  jest.useRealTimers();
});

const button = (name: string) => screen.getByRole('button', { name });
const critical = () =>
  screen.getByRole('switch', {
    name: 'Matérias críticas (que travam outras matérias)',
  });

/* ------------------------------------------------------------------ tests */

describe('Matérias críticas nas prioridades', () => {
  // o hook de verdade memoriza o grafo; um novo a cada chamada nunca assentaria
  const answer =
    (stored: ReturnType<typeof view>, loading: ReturnType<typeof view>) =>
    ({ load }: { load: boolean }) =>
      load ? loading : stored;

  it('reads nothing while off, then offers to read the prerequisites and reads on request', async () => {
    mockPlan.mockImplementation(
      answer(
        view(UNREAD),
        view(UNREAD, { status: 'reading', catalog: { done: 1, total: 3 } }),
      ),
    );
    await renderStep(<PriorityStep />, 2);
    expect(mockPlan).not.toHaveBeenCalled();

    await user.press(critical());
    expect(
      screen.getByText(
        /o app lê no Aluno Online os pré-requisitos das 3 obrigatórias que faltam/,
      ),
    ).toBeOnTheScreen();

    await user.press(button('Ler os pré-requisitos'));
    expect(mockPlan).toHaveBeenLastCalledWith({ load: true });
    expect(
      screen.getByText(/^Lendo os pré-requisitos: 1 de 3\. Pode seguir/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Pré-requisitos lidos: 1 de 3'),
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
    await renderStep(<PriorityStep />, 2, { priority: ['CRITICAL_FIRST'] });
    await user.press(button('Ler os pré-requisitos'));
    expect(
      screen.getByText(/^A leitura dos pré-requisitos parou/),
    ).toBeOnTheScreen();

    await user.press(button('Tentar novamente'));
    expect(retry).toHaveBeenCalled();
  });

  it('confirms when everything is read and explains when it cannot know', async () => {
    mockPlan.mockReturnValue(view(READ));
    await renderStep(<PriorityStep />, 2, { priority: ['CRITICAL_FIRST'] });
    expect(screen.getByText(/^Pré-requisitos lidos/)).toBeOnTheScreen();
    await screen.unmount();

    mockPlan.mockReturnValue(view(READ, { status: 'error' }));
    await renderStep(<PriorityStep />, 2, { priority: ['CRITICAL_FIRST'] });
    expect(
      screen.getByText(/esta prioridade não muda a ordem das grades/),
    ).toBeOnTheScreen();
  });
});

describe('Matérias críticas ao gerar', () => {
  const values = {
    min_subject_amount: 1,
    max_subject_amount: 2,
    subjects: [details('10871'), details('10880')],
  };

  it('sends how many pending subjects each chosen one locks', async () => {
    mockPlan.mockReturnValue(view(READ));
    await renderStep(<GenerationStep />, 6, {
      ...values,
      priority: ['CRITICAL_FIRST'],
    });
    await user.press(button('Gerar grades'));
    expect(mockGeneration.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        criticality: { 'IME02-10871': 2, 'IME02-10880': 1 },
      }),
    );
  });

  it('warns that generating while reading uses what was read', async () => {
    mockPlan.mockReturnValue(
      view(READ, { status: 'reading', catalog: { done: 2, total: 3 } }),
    );
    await renderStep(<GenerationStep />, 6, {
      ...values,
      priority: ['CRITICAL_FIRST'],
    });
    expect(
      screen.getByText(
        'Ainda lendo os pré-requisitos (2 de 3). Gerar agora usa o que já foi lido.',
      ),
    ).toBeOnTheScreen();
  });

  it('sends no count without the priority', async () => {
    await renderStep(<GenerationStep />, 6, {
      ...values,
      priority: ['MIN_GAPS'],
    });
    await user.press(button('Gerar grades'));
    expect(mockPlan).not.toHaveBeenCalled();
    expect(mockGeneration.mutate.mock.calls[0][0]).not.toHaveProperty(
      'criticality',
    );
  });
});
