import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import type {
  CurriculumSubject,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { renderWithProviders } from '@root/test-utils/render';
import { OUTLINED_GLYPHS } from '@components/ui';
import { CurriculumSubjects } from '../CurriculumSubjects';

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
let mockHistory: ReturnType<typeof makeQuery<SubjectsTaken[]>>;
const mockNavigate = jest.fn();

jest.mock('@root/modules/academics/presentation/queries', () => {
  const { AppError: MockAppError } = jest.requireActual<
    typeof import('@root/shared/errors/AppError')
  >('@root/shared/errors/AppError');
  return {
    useCurriculum: () => mockCurriculum,
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

const renderPage = () => renderWithProviders(<CurriculumSubjects />);
/** Linhas de disciplina, na ordem da lista: cada uma abre a disciplina. */
const subjectRows = () =>
  screen.queryAllByHintText('Abre os detalhes da disciplina');
const expectTitles = (titles: string[]) => {
  const rows = subjectRows();
  expect(rows).toHaveLength(titles.length);
  titles.forEach((title, i) =>
    expect(within(rows[i]).getByText(title)).toBeOnTheScreen(),
  );
};
const chip = (label: string) =>
  screen.getByRole('togglebutton', { name: label });
const searchField = () =>
  screen.getByLabelText('Pesquise pelo nome da disciplina');
/**
 * Os ícones são decorativos (fora da acessibilidade): devolve os glifos
 * desenhados no bloco mais próximo do texto (a etiqueta, o estado vazio).
 */
const glyphsBeside = (text: string | RegExp) => {
  const isPath = (node: TestInstance) => node.type === 'RNSVGPath';
  let block = screen.getByText(text).parent;
  while (block && block.queryAll(isPath).length === 0) block = block.parent;
  return block?.queryAll(isPath).map(path => path.props.d) ?? [];
};

beforeEach(() => {
  mockCurriculum = makeQuery(curriculum);
  mockHistory = makeQuery<SubjectsTaken[]>([]);
});
afterEach(() => {
  mockNavigate.mockClear();
});

it('lists the subjects not yet taken with code, type, details and the credit lock', async () => {
  await renderPage();
  expectTitles(['Compiladores', 'Projeto Final I', 'Aprendizado de Máquina']);
  for (const text of [
    'Exibindo 3 disciplinas',
    'IME02-10871 · Obrigatória',
    '6º período · 4 créditos · 60 horas',
    'Ramificação A · 4 créditos · 60 horas',
  ]) {
    expect(screen.getByText(text)).toBeOnTheScreen();
  }
  // uma só trava na lista, com o cadeado ao lado
  expect(screen.getByText(/^Trava de/)).toHaveTextContent(
    'Trava de 140 créditos',
  );
  expect(glyphsBeside('Trava de 140 créditos')).toContain(OUTLINED_GLYPHS.lock);
});

it('moves an approved course into attended even when the curriculum flag is negative', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([
    {
      ...curriculum[0],
      period: '2024.2',
      status: 'APPROVED',
      grade: 8,
      frequency: 100,
    },
  ]);
  await renderPage();
  expectTitles(['Projeto Final I', 'Aprendizado de Máquina']);
  await userEvent.setup().press(screen.getByRole('tab', { name: 'Atendidas' }));
  expectTitles(['Compiladores', 'Cálculo I']);
});

it('keeps curriculum usable and explains a failed history lookup', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await renderPage();
  expectTitles(['Compiladores', 'Projeto Final I', 'Aprendizado de Máquina']);
  expect(
    screen.getByText(/^Não foi possível conferir o histórico/),
  ).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
  await userEvent.setup().press(screen.getByRole('tab', { name: 'Atendidas' }));
  expectTitles(['Cálculo I']);
});

it('filters by type, by situation and by name or code', async () => {
  await renderPage();
  const user = userEvent.setup();
  expect(chip('Todas')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ checked: true }),
  );
  await user.press(chip('Eletivas Restritas'));
  expectTitles(['Aprendizado de Máquina']);
  await user.press(chip('Todas'));

  await user.press(screen.getByRole('tab', { name: 'Atendidas' }));
  expect(screen.getByRole('tab', { name: 'Atendidas' })).toBeSelected();
  expectTitles(['Cálculo I']);
  expect(screen.getByText('Atendida')).toBeOnTheScreen();
  expect(screen.getByText('Exibindo 1 disciplina')).toBeOnTheScreen();

  await user.press(screen.getByRole('tab', { name: 'Não atendidas' }));
  await user.type(searchField(), 'maquina');
  expectTitles(['Aprendizado de Máquina']);
  await user.clear(searchField());
  await user.type(searchField(), '10950');
  expectTitles(['Projeto Final I']);
});

it('shows the empty state when no subject matches the filters', async () => {
  await renderPage();
  await userEvent.setup().type(searchField(), 'inexistente');
  expectTitles([]);
  expect(screen.getByText('Exibindo 0 disciplinas')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Nenhuma disciplina encontrada com os filtros selecionados.',
    ),
  ).toBeOnTheScreen();
});

it('opens the subject in the subject search', async () => {
  await renderPage();
  await userEvent.setup().press(subjectRows()[0]);
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
  await renderPage();
  expect(screen.getAllByLabelText('Carregando disciplinas…')).toHaveLength(1);
  expect(
    screen.queryByText(/^Exibindo/, { includeHiddenElements: true }),
  ).not.toBeOnTheScreen();
  await screen.unmount();

  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await renderPage();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockCurriculum.refetch).toHaveBeenCalled();
});

it('explains a blocked portal when there is no saved curriculum', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined, {
    error: new AppError('POSSIBLY_BLOCKED'),
  });
  await renderPage();
  expect(
    screen.getByRole('alert', { name: /temporariamente bloqueado/ }),
  ).toBeOnTheScreen();
  expect(glyphsBeside(/temporariamente bloqueado/)).toContain(
    OUTLINED_GLYPHS.lock,
  );
});
