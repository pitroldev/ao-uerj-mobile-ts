import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import type { UniversalSubject } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import {
  EmptyState,
  ErrorState,
  ListRow,
  SearchField,
  SelectField,
} from '@components/ui';
import UniversalSubjects from '../UniversalSubjects';

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
jest.mock('react-native-modal', () => 'Modal');

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

let renderer: ReactTestRenderer;
const render = async () => {
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <UniversalSubjects />
      </ThemeProvider>,
    );
  });
};
const flatten = (children: unknown): string => {
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (typeof children === 'string' || typeof children === 'number')
    return String(children);
  if (React.isValidElement(children))
    return flatten((children.props as { children?: unknown }).children);
  return '';
};
const texts = () =>
  renderer.root.findAllByType(Text).map(node => flatten(node.props.children));
// as opções da folha de departamentos também são ListRow (sem a seta)
const subjectRows = () =>
  renderer.root.findAllByType(ListRow).filter(row => row.props.chevron);
const titles = () => subjectRows().map(row => row.props.title);
const select = () => renderer.root.findByType(SelectField);

beforeEach(() => {
  mockUniversals = makeQuery(universals);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  mockNavigate.mockClear();
});

it('lists every universal subject with credits, hours and the offering unit', async () => {
  await render();
  expect(titles()).toEqual([
    'Língua Brasileira de Sinais (Libras)',
    'Introdução à Programação',
  ]);
  expect(texts()).toContain('Exibindo 2 disciplinas');
  expect(texts()).toContain('ILE01-10301 · 2 créditos · 30 horas');
  expect(texts()).toContain('Instituto de Letras');
  expect(select().props.options.map((o: { value: string }) => o.value)).toEqual(
    ['', 'ILE', 'IME'],
  );
  expect(select().props.options.map((o: { label: string }) => o.label)).toEqual(
    [
      'Todos os departamentos',
      'ILE - Instituto de Letras',
      'IME - Instituto de Matemática e Estatística',
    ],
  );
  expect(select().props.value).toBe('');
  expect(texts()).toContain('Todos os departamentos');
});

it('filters by department and search, and clears the filters from the empty state', async () => {
  await render();
  await act(async () => select().props.onChange('IME'));
  expect(titles()).toEqual(['Introdução à Programação']);

  await act(async () =>
    renderer.root.findByType(SearchField).props.onChangeText('libras'),
  );
  expect(titles()).toEqual([]);
  expect(texts()).toContain('Exibindo 0 disciplinas');
  const empty = renderer.root.findByType(EmptyState);
  expect(empty.props.text).toBe(
    'Nenhuma disciplina encontrada com os filtros selecionados.',
  );
  await act(async () => empty.props.action.onPress());
  expect(titles()).toHaveLength(2);
  expect(select().props.value).toBe('');
});

it('opens the subject in the subject search', async () => {
  await render();
  await act(async () => subjectRows()[1].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME03-10044',
    sourceRoute: 'Disciplinas Universais',
  });
});

it('offers a retry when the list cannot be loaded', async () => {
  mockUniversals = makeQuery<UniversalSubject[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await render();
  expect(select().props.disabled).toBe(true);
  const state = renderer.root.findByType(ErrorState);
  await act(async () => state.props.onRetry());
  expect(mockUniversals.refetch).toHaveBeenCalled();
});

it('shows the empty message without a clear action when nothing is filtered', async () => {
  mockUniversals = makeQuery<UniversalSubject[]>([]);
  await render();
  const empty = renderer.root.findByType(EmptyState);
  expect(empty.props.action).toBeUndefined();
  expect(texts()).toContain('Exibindo 0 disciplinas');
});
