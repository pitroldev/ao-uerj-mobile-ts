import React from 'react';
import { onlineManager } from '@tanstack/react-query';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';

import type {
  AttendedClassesSchedule,
  CurriculumSubject,
  GraduationSynthesis,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits as mockDefaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import {
  PLAN_PREFERENCES_KEY,
  PlanPreferencesStore,
} from '@root/modules/graduation/application/PlanPreferencesStore';
import { PrerequisiteCatalog } from '@root/modules/graduation/application/PrerequisiteCatalog';
import {
  memoryStore,
  PLAN_CURRICULUM,
  PLAN_HISTORY,
  planDetails,
  planSynthesis,
  scheduleOf,
} from '@root/modules/graduation/__fixtures__/planFixtures';
import { AppError } from '@root/shared/errors/AppError';
import { headerStore } from '@templates/Header';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { GraduationPlanCard } from '@root/pages/MyProgress/GraduationPlanCard';
import { GraduationPlanPage } from '../GraduationPlan';

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
let mockSchedule: ReturnType<typeof makeQuery<AttendedClassesSchedule[]>>;
let mockSynthesis: ReturnType<typeof makeQuery<GraduationSynthesis>>;
let mockServices: unknown;
let mockElectiveCredits = mockDefaultElectiveCredits;
let mockParams: { sourceRoute?: string } | undefined;
const mockAccount = {
  scope: 's',
  name: 'Marina',
  matricula: '1',
  period: '2026.1',
};
const mockNavigation = { navigate: jest.fn(), setParams: jest.fn() };
const mockGetSubjectDetails = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@services/rootNavigation', () => ({
  isNavigationReady: () => false,
  getCurrentRouteName: () => undefined,
  toggleDrawer: jest.fn(),
  navigate: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: mockParams }),
  };
});
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useCurriculum: () => mockCurriculum,
  useHistory: () => mockHistory,
  useSchedule: () => mockSchedule,
  useSynthesis: () => mockSynthesis,
}));
jest.mock('@hooks/useElectiveCreditsConfig', () => ({
  useElectiveCreditsConfig: () => ({
    config: mockElectiveCredits,
    setConfig: jest.fn(),
  }),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ status: 'signedIn', account: mockAccount }),
  useAppServices: () => mockServices,
}));

let stores: ReturnType<typeof memoryStore>;
let queryClient: QueryClient;
const renderPage = () =>
  renderWithProviders(<GraduationPlanPage />, { queryClient });
const user = () => userEvent.setup();
/** O plano já montado: o prazo da Síntese só aparece com ele. */
const planReady = (deadline = 'Cabe no prazo, com 3 períodos de folga') =>
  screen.findByText(deadline);
/** A folha aberta (o `Modal` só fica na árvore enquanto ela está aberta). */
const subjectSheet = (name: string) =>
  screen.container
    .queryAll(node => node.type === 'Modal')
    .find(modal => within(modal).queryByRole('header', { name })) ?? null;
const storedChoices = () => stores.data.get(`s:${PLAN_PREFERENCES_KEY}`);

beforeEach(() => {
  mockCurriculum = makeQuery(PLAN_CURRICULUM);
  mockHistory = makeQuery(PLAN_HISTORY);
  mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
  mockSynthesis = makeQuery(planSynthesis());
  mockParams = undefined;
  mockElectiveCredits = mockDefaultElectiveCredits;
  stores = memoryStore();
  queryClient = createTestQueryClient();
  mockServices = {
    graduation: {
      prerequisites: new PrerequisiteCatalog(stores.store),
      preferences: new PlanPreferencesStore(stores.store),
    },
    identity: { getSnapshot: () => ({ account: mockAccount }) },
    academicRecords: { getSubjectDetails: mockGetSubjectDetails },
  };
  mockGetSubjectDetails.mockImplementation(async (id: string) =>
    planDetails(id),
  );
});

it('reads the prerequisites once and lays out the plan period by period', async () => {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  mockGetSubjectDetails.mockImplementation(async (id: string) => {
    await gate;
    return planDetails(id);
  });
  await renderPage();
  expect(
    await screen.findByLabelText('Pré-requisitos lidos: 0 de 4'),
  ).toBeOnTheScreen();
  await act(async () => release());

  await planReady();
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(4);
  expect(screen.getByLabelText('Formatura prevista: 2027.2')).toBeOnTheScreen();
  expect(screen.getByLabelText('Períodos no plano: 3')).toBeOnTheScreen();
  expect(screen.getByText('até 2029.1')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'O plano já está no mínimo possível: 3 períodos, pela cadeia Cálculo II → Cálculo III → Cálculo IV.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Trava 3 disciplinas · no plano em 2026.2'),
  ).toBeOnTheScreen();
  expect(screen.getAllByText('4 créditos')).toHaveLength(2);
  expect(screen.getByText('8 créditos')).toBeOnTheScreen();
  expect(screen.getByText('Próximo')).toBeOnTheScreen();
  // a cadeia já pede 3 períodos: com 2 por período a data é a mesma
  expect(
    screen.getByText(
      'A formatura fica em 2027.2 com até 2 disciplinas por período: mais carga não adianta a data.',
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('radio')).not.toBeOnTheScreen();

  // de volta à tela, os pré-requisitos guardados bastam
  await act(async () => screen.unmount());
  await renderPage();
  await planReady();
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(4);
});

it('keeps reading when the sources come back with the same subjects', async () => {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  // como o transporte: uma página cancelada no meio rejeita com CANCELLED
  mockGetSubjectDetails.mockImplementation(
    async (id: string, options?: { signal?: AbortSignal }) => {
      await gate;
      if (options?.signal?.aborted) throw new AppError('CANCELLED');
      return planDetails(id);
    },
  );
  await renderPage();
  expect(
    await screen.findByLabelText('Pré-requisitos lidos: 0 de 4'),
  ).toBeOnTheScreen();
  // os créditos de eletivas chegam do aparelho: outro objeto, mesmo conteúdo
  mockElectiveCredits = { ...mockDefaultElectiveCredits };
  await act(async () => screen.rerender(<GraduationPlanPage />));
  await act(async () => release());

  await planReady();
  expect(
    screen.queryByText(/^A leitura dos pré-requisitos parou/),
  ).not.toBeOnTheScreen();
  expect(screen.getByLabelText('Períodos no plano: 3')).toBeOnTheScreen();
});

it('reads again a page the restarted reading had cancelled', async () => {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  mockGetSubjectDetails.mockImplementation(
    async (id: string, options?: { signal?: AbortSignal }) => {
      await gate;
      if (options?.signal?.aborted) throw new AppError('CANCELLED');
      return planDetails(id);
    },
  );
  await renderPage();
  expect(
    await screen.findByLabelText('Pré-requisitos lidos: 0 de 4'),
  ).toBeOnTheScreen();
  // a grade chega com Cálculo II em curso: a leitura recomeça sem ela, e a
  // página de Cálculo III, que estava a caminho, foi cancelada junto
  mockSchedule = makeQuery([scheduleOf('IME01-10002', 'Cálculo II')]);
  await act(async () => screen.rerender(<GraduationPlanPage />));
  await act(async () => release());

  await planReady('Cabe no prazo, com 4 períodos de folga');
  expect(
    screen.queryByText(/^A leitura dos pré-requisitos parou/),
  ).not.toBeOnTheScreen();
  expect(
    mockGetSubjectDetails.mock.calls.filter(([id]) => id === 'IME01-10003'),
  ).toHaveLength(2);
});

it('updates the Meu Progresso card, still mounted, with what the plan read', async () => {
  // as telas do menu continuam montadas: o cartão e o plano ao mesmo tempo
  await renderWithProviders(
    <>
      <GraduationPlanCard />
      <GraduationPlanPage />
    </>,
    { queryClient },
  );
  await planReady();
  expect(
    screen.getByText(
      'Formatura prevista em 2027.2, em 3 períodos. 1 disciplina trava outras.',
    ),
  ).toBeOnTheScreen();
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(4);
});

it('opens a subject, postpones it a period and undoes it', async () => {
  await renderPage();
  await planReady();
  await user().press(screen.getAllByText('Cálculo II')[0]);
  const sheet = within(subjectSheet('Cálculo II')!);
  expect(
    sheet.getByText('IME01-10002 · 4 créditos · 60 h · Obrigatória'),
  ).toBeOnTheScreen();
  expect(sheet.getByText('Gargalo: trava 3 disciplinas')).toBeOnTheScreen();
  expect(sheet.getByText('Cursada')).toBeOnTheScreen();
  expect(sheet.getByText('No plano em 2027.1')).toBeOnTheScreen();
  expect(
    sheet.getByText(
      'Adiar para 2027.1 leva a formatura para 2028.1 (+1 período).',
    ),
  ).toBeOnTheScreen();

  await user().press(screen.getByRole('button', { name: 'Adiar um período' }));
  expect(
    await screen.findByRole('button', { name: 'Desfazer o adiamento' }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('Formatura prevista: 2028.1')).toBeOnTheScreen();
  expect(
    screen.getByText('Adiada por você: entra em 2027.1 ou depois.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Você adiou 1 disciplina.')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Sem disciplinas: o que sobrou foi adiado ou ainda espera pré-requisitos.',
    ),
  ).toBeOnTheScreen();
  expect(storedChoices()).toEqual({
    version: 1,
    load: null,
    postponed: { '10002': { period: '2027.1' } },
  });

  await user().press(
    screen.getByRole('button', { name: 'Desfazer o adiamento' }),
  );
  expect(
    await screen.findByLabelText('Formatura prevista: 2027.2'),
  ).toBeOnTheScreen();
  expect(storedChoices()).toMatchObject({ postponed: {} });
});

it('restores the plan the student postponed', async () => {
  stores.data.set(`s:${PLAN_PREFERENCES_KEY}`, {
    version: 1,
    load: null,
    postponed: { '10002': { period: '2027.1' } },
  });
  await renderPage();
  expect(
    await screen.findByLabelText('Formatura prevista: 2028.1'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Adiada por você')).toBeOnTheScreen();
  await user().press(screen.getByRole('button', { name: 'Restaurar o plano' }));
  expect(
    await screen.findByLabelText('Formatura prevista: 2027.2'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Você adiou 1 disciplina.')).not.toBeOnTheScreen();
});

it('lets the student pick a later graduation with a lighter load', async () => {
  // três sem pré-requisito a mais: com 3 por período a cadeia dita a data
  const free = ['Desenho', 'Física I', 'Química'].map((name, i) => ({
    ...PLAN_CURRICULUM[1],
    id: `IME01-1000${6 + i}`,
    name,
    period: 1,
  }));
  mockCurriculum = makeQuery([...PLAN_CURRICULUM, ...free]);
  await renderPage();
  await planReady();
  expect(screen.getByLabelText('Formatura prevista: 2027.2')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: /Formar em 2027.2/ })).toBeChecked();
  expect(
    screen.getByText('Até 3 disciplinas por período · 3 períodos'),
  ).toBeOnTheScreen();

  await user().press(screen.getByText('Formar em 2028.1'));
  expect(
    await screen.findByLabelText('Formatura prevista: 2028.1'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: /Formar em 2028.1/ })).toBeChecked();
  expect(
    screen.getByText(
      'Com até 2 disciplinas por período são 4 períodos. O mínimo possível é 3, pela cadeia Cálculo II → Cálculo III → Cálculo IV.',
    ),
  ).toBeOnTheScreen();
  // a última fica sozinha: o aviso do mínimo da inscrição
  expect(
    screen.getByText('Abaixo do mínimo de 2 disciplinas da inscrição'),
  ).toBeOnTheScreen();
  expect(storedChoices()).toMatchObject({ load: 2 });
});

it('counts the subjects in progress as passed', async () => {
  mockSchedule = makeQuery([scheduleOf('IME01-10002', 'Cálculo II')]);
  await renderPage();
  await planReady('Cabe no prazo, com 4 períodos de folga');
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(3);
  expect(screen.getByLabelText('Formatura prevista: 2027.1')).toBeOnTheScreen();
  await user().press(screen.getByText('Cálculo III'));
  expect(subjectSheet('Cálculo III')).toBeOnTheScreen();
  expect(screen.getByText('Em curso')).toBeOnTheScreen();
});

it('plans without the Síntese, from the account period', async () => {
  mockSynthesis = makeQuery<GraduationSynthesis>(
    undefined,
    new AppError('PORTAL_LAYOUT_CHANGED'),
  );
  await renderPage();
  expect(
    await screen.findByText(/^Sem a Síntese da Formação, o app não sabe/),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('Formatura prevista: 2027.2')).toBeOnTheScreen();
  expect(screen.queryByText(/^até /)).not.toBeOnTheScreen();
});

it('warns when the plan does not fit the deadline', async () => {
  mockSynthesis = makeQuery(planSynthesis({ remaining: 2 }));
  await renderPage();
  await planReady('Passa do prazo máximo em 1 período');
  expect(screen.getByText('até 2027.1')).toBeOnTheScreen();
  expect(
    screen.getByText(/^Procure a coordenação do curso antes do fim do prazo/),
  ).toBeOnTheScreen();
});

it('stops reading when the portal asks for a pause and tries again', async () => {
  mockGetSubjectDetails.mockRejectedValue(new AppError('POSSIBLY_BLOCKED'));
  await renderPage();
  expect(
    await screen.findByText(/^A leitura dos pré-requisitos parou/),
  ).toBeOnTheScreen();
  // as duas leituras em curso, e mais nenhuma
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(2);
  // sem os pré-requisitos, cabe tudo no próximo período
  expect(screen.getByLabelText('Formatura prevista: 2026.2')).toBeOnTheScreen();
  await user().press(screen.getAllByText('Cálculo IV')[0]);
  expect(
    screen.getByText(/^Os pré-requisitos desta disciplina não foram lidos/),
  ).toBeOnTheScreen();
  await user().press(screen.getByRole('button', { name: 'Pronto' }));

  mockGetSubjectDetails.mockImplementation(async (id: string) =>
    planDetails(id),
  );
  await user().press(screen.getByRole('button', { name: 'Tentar novamente' }));
  await planReady();
  expect(
    screen.queryByText(/^A leitura dos pré-requisitos parou/),
  ).not.toBeOnTheScreen();
});

it('reads the prerequisites again on request, past the page cache', async () => {
  await renderPage();
  await planReady();
  await user().press(
    screen.getByRole('button', { name: 'Ler os pré-requisitos de novo' }),
  );
  await planReady();
  expect(mockGetSubjectDetails).toHaveBeenCalledTimes(8);
});

it('keeps what was read when there is no internet to read again', async () => {
  await renderPage();
  await planReady();
  await act(() => onlineManager.setOnline(false));
  expect(
    screen.getByRole('button', { name: 'Ler os pré-requisitos de novo' }),
  ).toBeDisabled();
  await act(() => onlineManager.setOnline(true));
});

it('opens the subject in the Pesquisa de Disciplinas', async () => {
  await renderPage();
  await planReady();
  await user().press(screen.getAllByText('Cálculo II')[0]);
  await user().press(
    screen.getByRole('button', { name: 'Ver na Pesquisa de Disciplinas' }),
  );
  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    'Pesquisa de Disciplinas',
    { subjectId: 'IME01-10002', sourceRoute: 'Plano até a formatura' },
  );
});

it('goes back to Meu Progresso when opened from there', async () => {
  mockParams = { sourceRoute: 'Meu Progresso' };
  await renderPage();
  await planReady();
  const { onBack, backLabel } = headerStore.getSnapshot();
  expect(backLabel).toBe('Voltar para Meu Progresso');
  await act(async () => {
    onBack?.();
  });
  expect(mockNavigation.setParams).toHaveBeenCalledWith({
    sourceRoute: undefined,
  });
  expect(mockNavigation.navigate).toHaveBeenCalledWith('Meu Progresso');
});

it('says when there is nothing left to plan', async () => {
  mockHistory = makeQuery(
    PLAN_CURRICULUM.map(item => ({
      ...PLAN_HISTORY[0],
      id: item.id,
      name: item.name,
    })),
  );
  await renderPage();
  expect(await screen.findByText(/^Nada a planejar/)).toBeOnTheScreen();
  expect(mockGetSubjectDetails).not.toHaveBeenCalled();
});

it('offers a retry when the curriculum does not load', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(
    undefined,
    new AppError('NETWORK'),
  );
  await renderPage();
  await user().press(
    await screen.findByRole('button', { name: 'Tentar novamente' }),
  );
  expect(mockCurriculum.refetch).toHaveBeenCalled();
  expect(mockHistory.refetch).toHaveBeenCalled();
  expect(mockSynthesis.refetch).toHaveBeenCalled();
});
