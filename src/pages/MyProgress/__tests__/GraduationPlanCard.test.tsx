import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';

import type {
  AttendedClassesSchedule,
  CurriculumSubject,
  GraduationSynthesis,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits as mockDefaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import { PlanPreferencesStore } from '@root/modules/graduation/application/PlanPreferencesStore';
import { PrerequisiteCatalog } from '@root/modules/graduation/application/PrerequisiteCatalog';
import {
  memoryStore,
  PLAN_CURRICULUM,
  PLAN_HISTORY,
  planDetails,
  planSynthesis,
} from '@root/modules/graduation/__fixtures__/planFixtures';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { GraduationPlanCard } from '../GraduationPlanCard';

const makeQuery = <T,>(data: T | undefined, error: Error | null = null) => ({
  data,
  error,
  isLoading: false,
  isError: error !== null,
  isPaused: false,
  refetch: jest.fn(),
});
let mockCurriculum: ReturnType<typeof makeQuery<CurriculumSubject[]>>;
let mockHistory: ReturnType<typeof makeQuery<SubjectsTaken[]>>;
let mockSynthesis: ReturnType<typeof makeQuery<GraduationSynthesis>>;
const mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
let mockServices: unknown;
const mockAccount = {
  scope: 's',
  name: 'Marina',
  matricula: '1',
  period: '2026.1',
};
const mockNavigation = { navigate: jest.fn() };
const mockGetSubjectDetails = jest.fn();
let mockDisabledRoutes = new Set<string>();

jest.mock('@root/modules/delivery/presentation/FeatureGate', () => ({
  useDisabledRoutes: () => mockDisabledRoutes,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useCurriculum: () => mockCurriculum,
  useHistory: () => mockHistory,
  useSchedule: () => mockSchedule,
  useSynthesis: () => mockSynthesis,
}));
jest.mock('@hooks/useElectiveCreditsConfig', () => ({
  useElectiveCreditsConfig: () => ({
    config: mockDefaultElectiveCredits,
    setConfig: jest.fn(),
  }),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ status: 'signedIn', account: mockAccount }),
  useAppServices: () => mockServices,
}));

let stores: ReturnType<typeof memoryStore>;
const renderCard = () =>
  renderWithProviders(<GraduationPlanCard />, {
    queryClient: createTestQueryClient(),
  });
/** Os pré-requisitos já lidos numa visita anterior à tela do plano. */
const readBefore = () =>
  new PrerequisiteCatalog(stores.store).load(
    's',
    '2',
    PLAN_CURRICULUM.map(item => item.id),
    async id => planDetails(id),
    new AbortController().signal,
    () => undefined,
  );

beforeEach(() => {
  mockDisabledRoutes = new Set();
  mockCurriculum = makeQuery(PLAN_CURRICULUM);
  mockHistory = makeQuery(PLAN_HISTORY);
  mockSynthesis = makeQuery(planSynthesis());
  stores = memoryStore();
  mockServices = {
    graduation: {
      prerequisites: new PrerequisiteCatalog(stores.store),
      preferences: new PlanPreferencesStore(stores.store),
    },
    identity: { getSnapshot: () => ({ account: mockAccount }) },
    academicRecords: { getSubjectDetails: mockGetSubjectDetails },
  };
});

it('invites to build the plan without reading anything on the portal', async () => {
  await renderCard();
  expect(
    await screen.findByText(/Na primeira vez, o app lê os pré-requisitos/),
  ).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Montar o plano' }));
  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    'Plano até a formatura',
    { sourceRoute: 'Meu Progresso' },
  );
  expect(mockGetSubjectDetails).not.toHaveBeenCalled();
});

it('sums up the plan once the prerequisites were read', async () => {
  await readBefore();
  await renderCard();
  expect(
    await screen.findByText(
      'Formatura prevista em 2027.2, em 3 períodos. 1 disciplina trava outras.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ver o plano' })).toBeOnTheScreen();
  expect(
    screen.queryByText('Passa do prazo máximo da Síntese'),
  ).not.toBeOnTheScreen();
});

it('warns when the plan passes the deadline', async () => {
  mockSynthesis = makeQuery(planSynthesis({ remaining: 2 }));
  await readBefore();
  await renderCard();
  expect(
    await screen.findByText('Passa do prazo máximo da Síntese'),
  ).toBeOnTheScreen();
});

it('says when there is nothing to plan, without a button', async () => {
  mockHistory = makeQuery(
    PLAN_CURRICULUM.map(item => ({
      ...PLAN_HISTORY[0],
      id: item.id,
      name: item.name,
    })),
  );
  await renderCard();
  expect(await screen.findByText(/^Nada a planejar/)).toBeOnTheScreen();
  expect(screen.queryByRole('button')).not.toBeOnTheScreen();
});

it('stays out while the sources fail', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(
    undefined,
    new AppError('NETWORK'),
  );
  await renderCard();
  expect(screen.toJSON()).toBeNull();
});

it('disappears while the plan is disabled by the remote notice', async () => {
  mockDisabledRoutes = new Set(['Plano até a formatura']);
  await readBefore();
  await renderCard();
  expect(screen.toJSON()).toBeNull();
});
