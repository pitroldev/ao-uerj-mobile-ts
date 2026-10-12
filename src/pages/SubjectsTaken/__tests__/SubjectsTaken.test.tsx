import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import {
  EmptyState,
  ErrorState,
  GradeCell,
  SelectField,
  SkeletonList,
  TableRow,
} from '@components/ui';
import SubjectsTakenScreen from '../SubjectsTaken';

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
jest.mock('react-native-modal', () => 'Modal');

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

let renderer: ReactTestRenderer;
const render = async () => {
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <SubjectsTakenScreen />
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
const rows = () => renderer.root.findAllByType(TableRow);

afterEach(async () => {
  await act(async () => renderer?.unmount());
  mockNavigate.mockClear();
});

it('opens on the most recent period and labels each period with its CR', async () => {
  mockHistory = makeQuery(history);
  await render();
  const select = renderer.root.findByType(SelectField);
  expect(select.props.value).toBe('2026.2');
  expect(
    select.props.options.map((o: { value: string; aside?: string }) => [
      o.value,
      o.aside,
    ]),
  ).toEqual([
    ['2026.2', 'Em curso'],
    ['2026.1', 'CR atual 6,94'],
    ['2025.2', 'CR 5,50'],
  ]);
  expect(rows()).toHaveLength(1);
  expect(texts()).toContain('Em Preparo');
  expect(renderer.root.findByType(GradeCell).props.value).toBeNull();
});

it('summarises and lists the selected period in a table with status and grade', async () => {
  mockHistory = makeQuery(history);
  await render();
  await act(async () => {
    renderer.root.findByType(SelectField).props.onChange('2026.1');
  });
  expect(texts()).toContain('2 disciplinas');
  expect(texts()).toContain('6 créditos · 90 horas');
  expect(texts()).toContain('IME02-10872 · Obrigatória');
  expect(texts()).toContain('4 créditos · 60 h');
  expect(texts()).toContain('96%');
  expect(rows()).toHaveLength(2);
  expect(rows()[0].props.accessibilityLabel).toBe(
    'Inteligência Artificial, IME02-10872, Obrigatória, Aprovado, Frequência 96%, Nota 8,8, Bom, 4 créditos, 60 horas',
  );

  await act(async () => {
    renderer.root.findByType(SelectField).props.onChange('2025.2');
  });
  expect(texts()).toContain('Reprovado por Nota');
  expect(
    renderer.root.findAllByType(GradeCell).map(cell => cell.props.value),
  ).toEqual([7, 4]);
});

it('opens the subject in the subject search when a row is pressed', async () => {
  mockHistory = makeQuery(history);
  await render();
  await act(async () => rows()[0].props.onPress());
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
  await render();
  expect(renderer.root.findAllByType(SkeletonList)).toHaveLength(1);
  expect(renderer.root.findByType(SelectField).props.disabled).toBe(true);
});

it('offers a retry when the history cannot be loaded', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await render();
  const state = renderer.root.findByType(ErrorState);
  expect(state.props.message).toContain('erro ao buscar as disciplinas');
  await act(async () => state.props.onRetry());
  expect(mockHistory.refetch).toHaveBeenCalled();
});

it('explains a blocked portal when there is no saved history', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    error: new AppError('POSSIBLY_BLOCKED'),
  });
  await render();
  const state = renderer.root.findByType(EmptyState);
  expect(state.props.icon).toBe('lock');
  expect(state.props.text).toContain('temporariamente bloqueado');
  await act(async () => state.props.action.onPress());
  expect(mockHistory.refetch).toHaveBeenCalled();
});

it('keeps saved rows visible when a refresh fails', async () => {
  mockHistory = makeQuery(history, { error: new AppError('NETWORK') });
  await render();
  expect(rows()).toHaveLength(1);
  expect(renderer.root.findAllByType(ErrorState)).toHaveLength(0);
});

it('shows the real empty message when there is no history', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([]);
  await render();
  expect(renderer.root.findByType(EmptyState).props.text).toBe(
    'Parece que não há disciplinas cursadas no período selecionado.',
  );
});

it('treats a saved empty history as data when a refresh fails', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([], {
    error: new AppError('NETWORK'),
  });
  await render();
  expect(renderer.root.findAllByType(ErrorState)).toHaveLength(0);
  expect(renderer.root.findByType(EmptyState).props.icon).toBe('history_edu');
});
