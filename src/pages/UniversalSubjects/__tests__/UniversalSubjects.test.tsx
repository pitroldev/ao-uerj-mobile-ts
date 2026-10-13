import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';

import type { UniversalSubject } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { renderWithProviders } from '@root/test-utils/render';
import { UniversalSubjects } from '../UniversalSubjects';

const makeQuery = <T,>(
  data: T | undefined,
  overrides: Partial<{ error: Error | null }> = {},
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

let mockUniversals: ReturnType<typeof makeQuery<UniversalSubject[]>>;
const mockNavigate = jest.fn();

jest.mock('@root/modules/academics/presentation/queries', () => {
  const { AppError: MockAppError } = jest.requireActual<
    typeof import('@root/shared/errors/AppError')
  >('@root/shared/errors/AppError');
  return {
    useUniversalSubjects: () => mockUniversals,
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

const universals: UniversalSubject[] = [
  {
    id: 'ILE01-10301',
    name: 'Língua Brasileira de Sinais (Libras)',
    type: 'UNIVERSAL',
    credits: 2,
    workload: 30,
  },
  {
    id: 'IME03-10044',
    name: 'Introdução à Programação',
    type: 'UNIVERSAL',
    credits: 4,
    workload: 60,
  },
];

const ALL_DEPARTMENTS = 'Departamento: Todos os departamentos. Trocar';

const renderPage = () => renderWithProviders(<UniversalSubjects />);
// as opções da folha de departamentos também são linhas, mas sem a dica de abrir
const subjectRows = () =>
  screen.queryAllByHintText('Abre os detalhes da disciplina');
const expectTitles = (titles: string[]) => {
  const rows = subjectRows();
  expect(rows).toHaveLength(titles.length);
  titles.forEach((title, i) =>
    expect(within(rows[i]).getByText(title)).toBeOnTheScreen(),
  );
};
/** O seletor anuncia o departamento escolhido: "Departamento: X. Trocar". */
const departmentField = () =>
  screen.getByRole('button', { name: /^Departamento: / });
const searchField = () =>
  screen.getByLabelText('Pesquise pelo nome da disciplina');

beforeEach(() => {
  mockUniversals = makeQuery(universals);
});
afterEach(() => {
  mockNavigate.mockClear();
});

it('lists every universal subject with credits, hours and the offering unit', async () => {
  await renderPage();
  expectTitles([
    'Língua Brasileira de Sinais (Libras)',
    'Introdução à Programação',
  ]);
  expect(screen.getByText('Exibindo 2 disciplinas')).toBeOnTheScreen();
  expect(
    screen.getByText('ILE01-10301 · 2 créditos · 30 horas'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Instituto de Letras')).toBeOnTheScreen();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  // a folha do seletor: todos e um por unidade
  await userEvent.setup().press(departmentField());
  const options = screen.getAllByRole('radio');
  expect(options).toHaveLength(3);
  [
    'Todos os departamentos',
    'ILE - Instituto de Letras',
    'IME - Instituto de Matemática e Estatística',
  ].forEach((label, i) => expect(options[i]).toHaveAccessibleName(label));
  expect(options[0]).toBeChecked();
  expect(departmentField()).toHaveAccessibleName(ALL_DEPARTMENTS);
  expect(
    within(departmentField()).getByText('Todos os departamentos'),
  ).toBeOnTheScreen();
});

it('filters by department and search, and clears the filters from the empty state', async () => {
  await renderPage();
  const user = userEvent.setup();
  await user.press(departmentField());
  expect(departmentField()).toBeExpanded();
  await user.press(
    screen.getByRole('radio', {
      name: 'IME - Instituto de Matemática e Estatística',
    }),
  );
  expectTitles(['Introdução à Programação']);

  await user.type(searchField(), 'libras');
  expectTitles([]);
  expect(screen.getByText('Exibindo 0 disciplinas')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Nenhuma disciplina encontrada com os filtros selecionados.',
    ),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(subjectRows()).toHaveLength(2);
  expect(departmentField()).toHaveAccessibleName(ALL_DEPARTMENTS);
  expect(searchField()).toHaveDisplayValue('');
  await user.press(departmentField());
  expect(
    screen.getByRole('radio', { name: 'Todos os departamentos' }),
  ).toBeChecked();
});

it('opens the subject in the subject search', async () => {
  await renderPage();
  await userEvent.setup().press(subjectRows()[1]);
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME03-10044',
    sourceRoute: 'Disciplinas Universais',
  });
});

it('offers a retry when the list cannot be loaded', async () => {
  mockUniversals = makeQuery<UniversalSubject[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await renderPage();
  expect(departmentField()).toBeDisabled();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockUniversals.refetch).toHaveBeenCalled();
});

it('shows the empty message without a clear action when nothing is filtered', async () => {
  mockUniversals = makeQuery<UniversalSubject[]>([]);
  await renderPage();
  expect(
    screen.getByText(
      'Nenhuma disciplina encontrada com os filtros selecionados.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Limpar filtros' }),
  ).not.toBeOnTheScreen();
  expect(screen.getByText('Exibindo 0 disciplinas')).toBeOnTheScreen();
});
