import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import {
  EmptyState,
  ErrorState,
  FilterChip,
  ListRow,
  SearchField,
  SegmentedControl,
  SkeletonList,
  StatusLabel,
  Tag,
} from '@components/ui';
import CurriculumSubjects from '../CurriculumSubjects';

const makeQuery = <T,>(
  data: T | undefined,
  overrides: Partial<{
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
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

let mockCurriculum: ReturnType<typeof makeQuery<CurriculumSubject[]>>;
const mockNavigate = jest.fn();

jest.mock('@root/modules/academics/presentation/queries', () => {
  const { AppError: MockAppError } = jest.requireActual<
    typeof import('@root/shared/errors/AppError')
  >('@root/shared/errors/AppError');
  return {
    useCurriculum: () => mockCurriculum,
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

const curriculum: CurriculumSubject[] = [
  {
    id: 'IME02-10871',
    name: 'Compiladores',
    period: 6,
    type: 'MANDATORY',
    credits: 4,
    workload: 60,
    minimum_credits: null,
  },
  {
    id: 'IME02-10950',
    name: 'Projeto Final I',
    period: 7,
    type: 'MANDATORY',
    credits: 4,
    workload: 60,
    minimum_credits: 140,
  },
  {
    id: 'IME02-11024',
    name: 'Aprendizado de Máquina',
    type: 'RESTRICTED',
    branch: 'A',
    credits: 4,
    workload: 60,
    minimum_credits: null,
  },
  {
    id: 'IME01-10012',
    name: 'Cálculo I',
    period: 1,
    type: 'MANDATORY',
    credits: 6,
    workload: 90,
    minimum_credits: null,
    alreadyTaken: true,
  },
];

let renderer: ReactTestRenderer;
const render = async () => {
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <CurriculumSubjects />
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
const titles = () =>
  renderer.root.findAllByType(ListRow).map(row => row.props.title);
const chip = (label: string) =>
  renderer.root
    .findAllByType(FilterChip)
    .find(node => node.props.label === label)!;

beforeEach(() => {
  mockCurriculum = makeQuery(curriculum);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  mockNavigate.mockClear();
});

it('lists the subjects not yet taken with code, type, details and the credit lock', async () => {
  await render();
  expect(titles()).toEqual([
    'Compiladores',
    'Projeto Final I',
    'Aprendizado de Máquina',
  ]);
  expect(texts()).toContain('Exibindo 3 disciplinas');
  expect(texts()).toContain('IME02-10871 · Obrigatória');
  expect(texts()).toContain('6º período · 4 créditos · 60 horas');
  expect(texts()).toContain('Ramificação A · 4 créditos · 60 horas');
  const lock = renderer.root.findByType(Tag);
  expect(lock.props.label).toBe('Trava de 140 créditos');
  expect(lock.props.icon).toBe('lock');
});

it('filters by type, by situation and by name or code', async () => {
  await render();
  expect(chip('Todas').props.selected).toBe(true);
  await act(async () => chip('Eletivas Restritas').props.onPress());
  expect(titles()).toEqual(['Aprendizado de Máquina']);
  await act(async () => chip('Todas').props.onPress());

  await act(async () =>
    renderer.root.findByType(SegmentedControl).props.onChange('taken'),
  );
  expect(titles()).toEqual(['Cálculo I']);
  expect(renderer.root.findByType(StatusLabel).props.label).toBe('Atendida');
  expect(texts()).toContain('Exibindo 1 disciplina');

  await act(async () =>
    renderer.root.findByType(SegmentedControl).props.onChange('pending'),
  );
  await act(async () =>
    renderer.root.findByType(SearchField).props.onChangeText('maquina'),
  );
  expect(titles()).toEqual(['Aprendizado de Máquina']);
  await act(async () =>
    renderer.root.findByType(SearchField).props.onChangeText('10950'),
  );
  expect(titles()).toEqual(['Projeto Final I']);
});

it('shows the empty state when no subject matches the filters', async () => {
  await render();
  await act(async () =>
    renderer.root.findByType(SearchField).props.onChangeText('inexistente'),
  );
  expect(titles()).toEqual([]);
  expect(texts()).toContain('Exibindo 0 disciplinas');
  expect(renderer.root.findByType(EmptyState).props.text).toBe(
    'Nenhuma disciplina encontrada com os filtros selecionados.',
  );
});

it('opens the subject in the subject search', async () => {
  await render();
  await act(async () =>
    renderer.root.findAllByType(ListRow)[0].props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME02-10871',
    sourceRoute: 'Disciplinas do Currículo',
  });
});

it('shows a skeleton while loading and a retry on failure', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  await render();
  expect(renderer.root.findAllByType(SkeletonList)).toHaveLength(1);
  expect(texts().some(t => t.startsWith('Exibindo'))).toBe(false);
  await act(async () => renderer.unmount());

  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await render();
  const state = renderer.root.findByType(ErrorState);
  await act(async () => state.props.onRetry());
  expect(mockCurriculum.refetch).toHaveBeenCalled();
});

it('explains a blocked portal when there is no saved curriculum', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined, {
    error: new AppError('POSSIBLY_BLOCKED'),
  });
  await render();
  const state = renderer.root.findByType(EmptyState);
  expect(state.props.icon).toBe('lock');
  expect(state.props.text).toContain('temporariamente bloqueado');
});
