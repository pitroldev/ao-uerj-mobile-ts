import React from 'react';
import {
  fireEvent,
  renderHook,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import type {
  SubjectsTaken,
  CurriculumSubject,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits as mockDefaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import { AppError } from '@root/shared/errors/AppError';
import { SnackbarHost } from '@components/ui';
import { renderWithProviders } from '@root/test-utils/render';
import { MyProgressPage } from '../MyProgress';
import { useMyProgress } from '../useMyProgress';

const makeQuery = <T,>(data: T | undefined, error: Error | null = null) => ({
  data,
  error,
  isLoading: false,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: data === undefined ? 0 : 1700000000000,
  refetch: jest.fn(),
});
let mockHistory: ReturnType<typeof makeQuery<SubjectsTaken[]>>;
let mockCurriculum: ReturnType<typeof makeQuery<CurriculumSubject[]>>;
const mockSetConfig = jest.fn();
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useHistory: () => mockHistory,
  useCurriculum: () => mockCurriculum,
}));
jest.mock('@hooks/useElectiveCreditsConfig', () => ({
  useElectiveCreditsConfig: () => ({
    config: mockDefaultElectiveCredits,
    setConfig: mockSetConfig,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const history: SubjectsTaken[] = [
  {
    id: 'IME01-12345',
    name: 'Álgebra',
    period: '2024/1',
    credits: 4,
    workload: 60,
    type: 'MANDATORY',
    frequency: 100,
    grade: 8,
    status: 'APPROVED',
  },
];
const curriculum: CurriculumSubject[] = ['IME01-12345', 'IME01-12346'].map(
  id => ({
    id,
    name: 'Álgebra',
    type: 'MANDATORY',
    credits: 4,
    workload: 60,
    minimum_credits: null,
  }),
);
const renderPage = () => renderWithProviders(<MyProgressPage />);
/** Ausência de texto vale também para o que está fora da acessibilidade. */
const queryAnyText = (text: string | RegExp) =>
  screen.queryByText(text, { includeHiddenElements: true });
/** Números de destaque ("Disciplinas concluídas: 1"), na ordem da tela. */
const stats = () =>
  screen.queryAllByLabelText(/^(Disciplinas concluídas|CR aproximado): /);
/** As barras do caminho são decorativas: a linha já anuncia o percentual. */
const progressBars = () =>
  screen.queryAllByRole('progressbar', { includeHiddenElements: true });
/**
 * A folha aberta: o `Modal` só fica na árvore enquanto ela está aberta (o
 * mock do preset devolve `null` com `visible` falso, e a folha desmonta o
 * `Modal` depois da animação de saída).
 */
const creditsSheet = () =>
  screen.container
    .queryAll(node => node.type === 'Modal')
    .find(modal =>
      within(modal).queryByRole('header', {
        name: 'Configurar créditos exigidos',
      }),
    ) ?? null;

beforeEach(() => {
  mockHistory = makeQuery(history);
  mockCurriculum = makeQuery(curriculum);
});

it('preserves curriculum-confirmed completion when history is unavailable without displaying a fabricated zero CR', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, new AppError('NETWORK'));
  mockCurriculum = makeQuery([{ ...curriculum[0], alreadyTaken: true }]);
  await renderPage();
  expect(stats()[0]).toHaveAccessibleName('Disciplinas concluídas: 1');
  expect(stats()[1]).toHaveAccessibleName('CR aproximado: –');
  expect(screen.getByText('1 de 1 disciplinas · concluído')).toBeOnTheScreen();
  expect(queryAnyText('CR aproximado: 0,00')).not.toBeOnTheScreen();
});

it('preserves completed courses from history without inventing curriculum totals after a partial failure', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(
    undefined,
    new AppError('NETWORK'),
  );
  await renderPage();
  expect(
    screen.getByText('1 concluída · 4 créditos concluídos'),
  ).toBeOnTheScreen();
  expect(screen.getByText(/^Currículo indisponível/)).toBeOnTheScreen();
  expect(queryAnyText(/\d+ de 0 /)).not.toBeOnTheScreen();
  expect(queryAnyText(/\d+ no currículo/)).not.toBeOnTheScreen();
  expect(progressBars()).toHaveLength(0);
  // uma só ação de nova tentativa: a do aviso de falha no topo
  expect(
    screen.getAllByRole('button', { name: 'Tentar novamente' }),
  ).toHaveLength(1);
});

it('keeps a known denominator and progress when saved curriculum data survives a refresh failure', async () => {
  mockCurriculum = makeQuery(curriculum, new AppError('NETWORK'));
  await renderPage();
  expect(screen.getByText('1 de 2 disciplinas · faltam 1')).toBeOnTheScreen();
  expect(screen.getByText('50%')).toBeOnTheScreen();
  expect(queryAnyText(/Currículo indisponível/)).not.toBeOnTheScreen();
  expect(progressBars()).toHaveLength(1);
  expect(progressBars()[0]).toHaveAccessibilityValue({ now: 50 });
});

it('does not show a ratio or percentage for a successful empty curriculum', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>([]);
  await renderPage();
  expect(queryAnyText(/\d+ de 0 /)).not.toBeOnTheScreen();
  expect(queryAnyText(/Currículo indisponível/)).not.toBeOnTheScreen();
  expect(progressBars()).toHaveLength(0);
});

it('shows the completed count and the approximate CR with its disclaimer', async () => {
  await renderPage();
  const items = stats();
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveAccessibleName('Disciplinas concluídas: 1');
  expect(within(items[0]).getByText('1')).toBeOnTheScreen();
  expect(items[1]).toHaveAccessibleName('CR aproximado: 8,00');
  expect(within(items[1]).getByText('8,00')).toBeOnTheScreen();
  expect(screen.getByText(/pode ser diferente do oficial/)).toBeOnTheScreen();
  expect(
    screen.getByRole('image', { name: 'CR acumulado em 2024/1: 8,00' }),
  ).toBeOnTheScreen();
  // a média do período só aparece no desenho: o ponto completo vem do hook
  const { result } = await renderHook(() => useMyProgress());
  expect(result.current.crPoints).toEqual([
    { label: '2024/1', cra: 8, periodAverage: 8 },
  ]);
});

it('shows a skeleton instead of empty numbers while the first load runs', async () => {
  mockHistory = { ...makeQuery<SubjectsTaken[]>(undefined), isLoading: true };
  mockCurriculum = {
    ...makeQuery<CurriculumSubject[]>(undefined),
    isLoading: true,
  };
  await renderPage();
  const skeletons = screen.getAllByLabelText('Carregando dados…');
  expect(skeletons.length).toBeGreaterThan(0);
  expect(skeletons[0]).toBeBusy();
  expect(stats()).toHaveLength(0);
});

it('offers a retry when nothing could be loaded', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, new AppError('NETWORK'));
  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined);
  await renderPage();
  expect(
    screen.getByRole('alert', {
      name: 'Não foi possível carregar seu progresso. Toque para tentar novamente.',
    }),
  ).toBeOnTheScreen();
  expect(stats()).toHaveLength(0);
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockHistory.refetch).toHaveBeenCalled();
  expect(mockCurriculum.refetch).toHaveBeenCalled();
});

it('explains when there is no history or curriculum yet', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([]);
  mockCurriculum = makeQuery<CurriculumSubject[]>([]);
  await renderPage();
  expect(
    screen.getByText('Ainda não há histórico ou currículo disponível.'),
  ).toBeOnTheScreen();
  expect(stats()).toHaveLength(0);
});

it('asks for the elective credits and saves them from the sheet', async () => {
  mockSetConfig.mockResolvedValue(true);
  // o host de avisos da raiz, como no App
  await renderWithProviders(
    <>
      <MyProgressPage />
      <SnackbarHost />
    </>,
  );
  expect(
    screen.getByText('Configure os créditos necessários para ver o progresso.'),
  ).toBeOnTheScreen();
  expect(screen.getAllByText('Sem meta').length).toBeGreaterThan(0);
  expect(creditsSheet()).not.toBeOnTheScreen();

  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Configurar créditos' }));
  expect(creditsSheet()).toBeOnTheScreen();

  const restricted = screen.getByLabelText(
    'Créditos exigidos de Eletiva Restrita',
  );
  // ao focar, o valor fica selecionado e o que se digita o substitui
  expect(restricted).toHaveProp('selectTextOnFocus', true);
  await user.clear(restricted);
  await user.type(restricted, '16');
  await user.press(screen.getByRole('button', { name: 'Salvar' }));

  expect(mockSetConfig).toHaveBeenCalledWith({
    RESTRICTED: 16,
    DEFINED: 0,
    UNIVERSAL: 0,
  });
  await waitFor(() => expect(creditsSheet()).not.toBeOnTheScreen());
  // o aviso nasceu no host da folha e passou para o da raiz quando ela fechou
  expect(
    await screen.findByLabelText(
      'Créditos salvos. O progresso foi recalculado.',
    ),
  ).toBeOnTheScreen();
});

it('draws the CR line, the period average and the values once measured', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([
    ...history,
    { ...history[0], id: 'IME01-2', period: '2024/2', grade: 6 },
    { ...history[0], id: 'IME01-3', period: '2025/1', grade: 9 },
  ]);
  await renderPage();
  const chart = screen.getByRole('image', {
    name: 'CR acumulado de 2024/1 a 2025/1: de 8,00 para 7,67',
  });
  // o desenho é decorativo (o gráfico se apresenta pelo rótulo): cada
  // Polyline vira um caminho RNSVGPath e cada texto, um RNSVGTSpan com `content`
  const lines = () => chart.queryAll(node => node.type === 'RNSVGPath');
  expect(lines()).toHaveLength(0);
  await fireEvent.layout(chart, { width: 354, height: 200 });
  expect(lines()).toHaveLength(2);
  const labels = chart
    .queryAll(node => node.type === 'RNSVGTSpan')
    .map(node => node.props.content);
  expect(labels).toEqual(
    expect.arrayContaining(['8,00', '7,00', '7,67', '2024/1', '2025/1']),
  );
});
