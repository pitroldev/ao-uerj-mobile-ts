import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';

import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { renderWithProviders } from '@root/test-utils/render';
import { OUTLINED_GLYPHS } from '@components/ui';
import { SubjectsTakenScreen } from '../SubjectsTaken';

const makeQuery = <T,>(
  data: T | undefined,
  overrides: Partial<{
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
    isPaused: boolean;
  }> = {},
) => ({
  data,
  error: null as Error | null,
  isLoading: false,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: data === undefined ? 0 : 1700000000000,
  refetch: jest.fn(),
  ...overrides,
});

let mockHistory: ReturnType<typeof makeQuery<SubjectsTaken[]>>;
const mockNavigate = jest.fn();

jest.mock('@root/modules/academics/presentation/queries', () => {
  const { AppError: MockAppError } = jest.requireActual<
    typeof import('@root/shared/errors/AppError')
  >('@root/shared/errors/AppError');
  return {
    useHistory: () => mockHistory,
    isPortalBlocked: (error: unknown) =>
      error instanceof MockAppError && error.code === 'POSSIBLY_BLOCKED',
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const subject = (
  period: string,
  id: string,
  name: string,
  status: SubjectsTaken['status'],
  grade: number | null,
  frequency: number | null,
  credits = 4,
): SubjectsTaken => ({
  id,
  name,
  period,
  credits,
  workload: credits * 15,
  type: 'MANDATORY',
  frequency,
  grade,
  status,
});

const history: SubjectsTaken[] = [
  subject('2025.2', 'IME02-10801', 'Cálculo I', 'APPROVED', 7, 92),
  subject('2025.2', 'IME02-10802', 'Física I', 'FAILED_BY_GRADE', 4, 80),
  subject(
    '2026.1',
    'IME02-10872',
    'Inteligência Artificial',
    'APPROVED',
    8.8,
    96,
  ),
  subject('2026.1', 'ICS01-10230', 'Empreendedorismo', 'APPROVED', 9, 96, 2),
  subject(
    '2026.2',
    'IME02-10892',
    'Sistemas Distribuídos',
    'IN_PROGRESS',
    null,
    null,
  ),
];

const renderScreen = () => renderWithProviders(<SubjectsTakenScreen />);
const periodField = () => screen.getByRole('button', { name: /^Período: / });
/** Linhas da tabela do período; cada uma abre a disciplina. */
const rows = (period: string) =>
  within(
    screen.getByLabelText(`Disciplinas cursadas em ${period}`),
  ).getAllByRole('button');
/** Abre o seletor de período e escolhe a opção pelo nome lido na folha. */
const choosePeriod = async (option: string) => {
  const user = userEvent.setup();
  await user.press(periodField());
  await user.press(screen.getByRole('radio', { name: option }));
};
/** O ícone do estado vazio é decorativo (fora da acessibilidade): confere o glifo desenhado. */
const drawsIcon = (name: keyof typeof OUTLINED_GLYPHS) =>
  screen.container.queryAll(node => node.props.d === OUTLINED_GLYPHS[name])
    .length > 0;

afterEach(() => {
  mockNavigate.mockClear();
});

it('opens on the most recent period and labels each period with its CR', async () => {
  mockHistory = makeQuery(history);
  await renderScreen();
  expect(screen.getByText(/^O CR é calculado pelo app/)).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Período: 2026.2, Em curso. Trocar' }),
  ).toBeOnTheScreen();
  await userEvent.setup().press(periodField());
  expect(periodField()).toBeExpanded();
  const options = screen.getAllByRole('radio');
  expect(options).toHaveLength(3);
  expect(options[0]).toHaveAccessibleName('2026.2 Em curso');
  expect(options[1]).toHaveAccessibleName('2026.1 CR aprox. atual 6,94');
  expect(options[2]).toHaveAccessibleName('2025.2 CR aprox. 5,50');
  expect(options[0]).toBeChecked();
  expect(rows('2026.2')).toHaveLength(1);
  const [row] = rows('2026.2');
  expect(within(row).getByText('Em Preparo')).toBeOnTheScreen();
  expect(within(row).getByLabelText('sem nota')).toHaveTextContent('–');
});

it('allows a manual refresh of a successful history instead of waiting for its cache lifetime', async () => {
  mockHistory = makeQuery(history);
  await renderScreen();
  let scroll = periodField().parent;
  while (scroll && scroll.type !== 'RCTScrollView') scroll = scroll.parent;
  expect(scroll).not.toBeNull();
  await userEvent.setup().pullToRefresh(scroll!);
  expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
});

it('summarises and lists the selected period in a table with status and grade', async () => {
  mockHistory = makeQuery(history);
  await renderScreen();
  await choosePeriod('2026.1 CR aprox. atual 6,94');
  expect(screen.getByText('2 disciplinas')).toBeOnTheScreen();
  expect(screen.getByText('6 créditos · 90 horas')).toBeOnTheScreen();
  const periodRows = rows('2026.1');
  expect(periodRows).toHaveLength(2);
  expect(
    within(periodRows[0]).getByText('IME02-10872 · Obrigatória'),
  ).toBeOnTheScreen();
  expect(
    within(periodRows[0]).getByText('4 créditos · 60 h'),
  ).toBeOnTheScreen();
  expect(within(periodRows[0]).getByText('96%')).toBeOnTheScreen();
  expect(periodRows[0]).toHaveAccessibleName(
    'Inteligência Artificial, IME02-10872, Obrigatória, Aprovado, Frequência 96%, Nota 8,8, Bom, 4 créditos, 60 horas',
  );

  await choosePeriod('2025.2 CR aprox. 5,50');
  expect(screen.getByText('Reprovado por Nota')).toBeOnTheScreen();
  const grades = rows('2025.2').map(row =>
    within(row).getByLabelText(/^Nota /),
  );
  expect(grades).toHaveLength(2);
  expect(grades[0]).toHaveTextContent('7,0');
  expect(grades[1]).toHaveTextContent('4,0');
});

it('opens the subject in the subject search when a row is pressed', async () => {
  mockHistory = makeQuery(history);
  await renderScreen();
  await userEvent.setup().press(rows('2026.2')[0]);
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME02-10892',
    sourceRoute: 'Disciplinas Realizadas',
  });
});

it('shows a skeleton while the first load is running', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  await renderScreen();
  expect(screen.getByLabelText('Carregando disciplinas…')).toBeOnTheScreen();
  expect(periodField()).toBeDisabled();
});

it('offers a retry when the history cannot be loaded', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await renderScreen();
  expect(screen.getByRole('alert')).toHaveTextContent(
    /erro ao buscar as disciplinas/,
  );
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockHistory.refetch).toHaveBeenCalled();
});

it('explains a blocked portal when there is no saved history', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    error: new AppError('POSSIBLY_BLOCKED'),
  });
  await renderScreen();
  expect(drawsIcon('lock')).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent(
    /temporariamente bloqueado/,
  );
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockHistory.refetch).toHaveBeenCalled();
});

it('keeps saved rows visible when a refresh fails', async () => {
  mockHistory = makeQuery(history, { error: new AppError('NETWORK') });
  await renderScreen();
  expect(rows('2026.2')).toHaveLength(1);
  expect(
    screen.queryByText(/erro ao buscar as disciplinas/),
  ).not.toBeOnTheScreen();
});

it('shows the real empty message when there is no history', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([]);
  await renderScreen();
  expect(
    screen.getByText(
      'Parece que não há disciplinas cursadas no período selecionado.',
    ),
  ).toBeOnTheScreen();
});

it('treats a saved empty history as data when a refresh fails', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([], {
    error: new AppError('NETWORK'),
  });
  await renderScreen();
  expect(
    screen.queryByText(/erro ao buscar as disciplinas/),
  ).not.toBeOnTheScreen();
  expect(drawsIcon('history_edu')).toBe(true);
  expect(
    screen.getByText(
      'Parece que não há disciplinas cursadas no período selecionado.',
    ),
  ).toBeOnTheScreen();
});
