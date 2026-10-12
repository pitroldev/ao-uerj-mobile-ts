import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import { AppError } from '@root/shared/errors/AppError';
import type {
  AttendedClassesSchedule,
  ClassGrade,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import {
  BottomSheet,
  EmptyState,
  ErrorState,
  ListRow,
  Notice,
  TableRow,
} from '@components/ui';
import HomePage from '../Home';
import HomeSkeleton from '../components/HomeSkeleton';

type QueryOverrides = Partial<{
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isPaused: boolean;
  refetch: jest.Mock;
}>;

const makeQuery = <T,>(
  data: T | undefined,
  overrides: QueryOverrides = {},
) => ({
  data,
  error: null as Error | null,
  isLoading: false,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: data === undefined ? 0 : 1700000000000,
  refetch: jest.fn(() => Promise.resolve()),
  ...overrides,
});

let mockSchedule: ReturnType<typeof makeQuery<AttendedClassesSchedule[]>>;
let mockGrades: ReturnType<typeof makeQuery<ClassGrade[]>>;
let mockRid: ReturnType<typeof makeQuery<PartialRidResult>>;
let mockOnline = true;
const mockNavigate = jest.fn();
const mockShare = jest.fn();
/** Terça, 13/10/2026, 11:58 (o "agora" do protótipo). */
const mockNow = new Date(2026, 9, 13, 11, 58);

jest.mock('@root/modules/academics/presentation/queries', () => {
  const { AppError: MockAppError } = jest.requireActual<
    typeof import('@root/shared/errors/AppError')
  >('@root/shared/errors/AppError');
  return {
    useSchedule: () => mockSchedule,
    useGrades: () => mockGrades,
    usePartialRid: () => mockRid,
    isPortalBlocked: (error: unknown) =>
      error instanceof MockAppError && error.code === 'POSSIBLY_BLOCKED',
  };
});
jest.mock('@root/modules/academics/presentation/useOnlineStatus', () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock('@root/modules/academics/presentation/useScheduleSharing', () => ({
  useScheduleSharing: () => ({
    share: mockShare,
    exporting: false,
    SvgRenderer: () => null,
  }),
}));
jest.mock('@features/AttendedClassesSchedule/useNow', () => ({
  useNow: () => mockNow,
}));
// objetos estáveis: os efeitos dependem da identidade de `account` e `preferences`
const mockIdentity = {
  status: 'signedIn',
  account: {
    scope: 's',
    name: 'MARINA ALBUQUERQUE TEIXEIRA',
    matricula: '202310045612',
    period: '2026.2',
  },
};
const mockServices = {
  preferences: {
    read: () => Promise.resolve('0.0.0'),
    write: () => Promise.resolve(),
  },
};
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentity,
  useAppServices: () => mockServices,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
const mockToast = jest.requireMock('react-native-toast-message') as {
  show: jest.Mock;
};

const LOC_B = 'Pav. João Lyra Filho · 6º andar · Sala 6019 B';
const LOC_D = 'Pav. João Lyra Filho · 6º andar · Sala 6113 D';

const subject = (
  id: string,
  name: string,
  uerjLocation?: string,
  status = 'ACTIVE',
) => ({
  id,
  name,
  class: '1',
  avaLocation: '',
  uerjLocation: uerjLocation as string,
  status,
});

const meeting = (
  info: ReturnType<typeof subject>,
  dayNumber: number,
  periodAlias: string,
  start: [string, number],
  end: [string, number],
): AttendedClassesSchedule => ({
  class: info,
  dayAlias: '',
  dayNumber,
  subject_id: info.id,
  periodAlias,
  startTimeAlias: start[0],
  endTimeAlias: end[0],
  start_time_in_minutes: start[1],
  end_time_in_minutes: end[1],
});

const OTIM = subject('IME04-10933', 'Otimização Combinatória', LOC_B);
const COMP = subject('IME02-10871', 'Compiladores', LOC_D);
const SIST = subject('IME02-10892', 'Sistemas Distribuídos', LOC_B);
const CG = subject('IME02-10880', 'Computação Gráfica', undefined, 'CANCELED');

const schedule: AttendedClassesSchedule[] = [
  meeting(SIST, 1, 'T3', ['14:20', 860], ['16:00', 960]),
  meeting(COMP, 2, 'M3', ['8:50', 530], ['10:30', 630]),
  meeting(OTIM, 2, 'T1', ['12:20', 740], ['14:10', 850]),
  meeting(COMP, 4, 'M3', ['8:50', 530], ['10:30', 630]),
  meeting(OTIM, 4, 'T1', ['12:20', 740], ['14:10', 850]),
  meeting(CG, 6, 'M3', ['8:50', 530], ['10:30', 630]),
];

const grades: ClassGrade[] = [
  {
    id: 'IME02-10892',
    name: 'Sistemas Distribuídos',
    class: '2',
    grades: { p1: 8.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10871',
    name: 'Compiladores',
    class: '1',
    grades: { p1: 6, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10905',
    name: 'Ética e Computação',
    class: '3',
    grades: { p1: null, p2: null, pf: null, result: 9 },
  },
];

const rid: PartialRidResult = {
  updatedAt: ' 12/08/2026 14:32 ',
  subjects: [
    {
      id: 'IME02-10892',
      name: 'Sistemas Distribuídos',
      classNumber: '2',
      available: 40,
      requested: 38,
      position: 12,
      status: 'Deferida',
    },
    {
      id: 'IME02-10880',
      name: 'Computação Gráfica',
      classNumber: '1',
      available: 30,
      requested: 44,
      position: 0,
      status: 'Indeferida: choque de horário',
    },
  ],
};

let renderer: ReactTestRenderer;
const render = async () => {
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <HomePage />
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
const pressable = (label: string) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];

beforeEach(() => {
  mockOnline = true;
  mockSchedule = makeQuery(schedule);
  mockGrades = makeQuery(grades);
  mockRid = makeQuery<PartialRidResult>({ subjects: [], updatedAt: '' });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  mockNavigate.mockClear();
  mockShare.mockReset();
});

it('greets the student and answers the next class first', async () => {
  await render();
  expect(texts()).toContain('Olá, Marina');
  expect(texts()).toContain('Terça, 13 de outubro');
  expect(texts()).toContain('Hoje · em 22 min');
  expect(
    pressable(
      'Otimização Combinatória, 12:20 às 14:10, Sala 6019 B. Ver disciplinas em curso',
    ),
  ).toBeDefined();
  expect(texts()).toContain('T1–T2 · Sala 6019 B');
  expect(texts()).toContain('Pav. João Lyra Filho · 6º andar');
});

it('lists the grades with health spelled out, never by color alone', async () => {
  await render();
  const rows = renderer.root.findAllByType(TableRow);
  expect(rows.map(row => row.props.accessibilityLabel)).toEqual([
    'Sistemas Distribuídos: P1 8,5, P2 sem nota, PF sem nota, Média sem nota. Bom na P1',
    'Compiladores: P1 6,0, P2 sem nota, PF sem nota, Média sem nota. Atenção na P1',
    'Ética e Computação: P1 sem nota, P2 sem nota, PF sem nota, Média 9,0. Bom na média',
  ]);
  expect(texts()).toContain('Atenção: 5 a 6,9');
});

it('shows today as a timeline with the free gap, the now line and finished classes', async () => {
  await render();
  expect(texts()).toContain('2 aulas');
  expect(texts()).toContain('Hoje');
  expect(texts()).toContain('Livre · 1h50');
  expect(texts()).toContain('Encerrada');
  expect(
    renderer.root.findAll(n => n.props.accessibilityLabel === 'Agora, 11:58')
      .length,
  ).toBeGreaterThan(0);
  expect(
    pressable('Compiladores, 8:50 às 10:30, M3–M4, Sala 6113 D, encerrada'),
  ).toBeDefined();
});

it('switches days and marks canceled classes with a label', async () => {
  await render();
  await act(async () => pressable('Sábado, 17 de outubro').props.onPress());
  expect(texts()).toContain('Sábado, 17 de outubro');
  expect(texts()).toContain('Cancelada');
  await act(async () =>
    pressable('Sexta, 16 de outubro, sem aulas').props.onPress(),
  );
  expect(texts()).toContain('Sem aulas neste dia.');
});

it('opens the classes sheet focused on the tapped class and navigates from it', async () => {
  await render();
  const sheet = () =>
    renderer.root
      .findAllByType(BottomSheet)
      .find(s => s.props.title === 'Disciplinas em Curso')!;
  expect(sheet().props.visible).toBe(false);
  await act(async () =>
    pressable(
      'Otimização Combinatória, 12:20 às 14:10, T1–T2, Sala 6019 B, Tarde',
    ).props.onPress(),
  );
  expect(sheet().props.visible).toBe(true);
  expect(sheet().props.meta).toBe('3 ativas');
  const rows = sheet().findAllByType(ListRow);
  expect(rows.map(r => [r.props.title, Boolean(r.props.highlighted)])).toEqual([
    ['Sistemas Distribuídos', false],
    ['Compiladores', false],
    ['Otimização Combinatória', true],
    ['Computação Gráfica', false],
  ]);
  expect(rows[2].props.meta).toEqual([
    'Ter e Qui · T1–T2 · 12:20–14:10',
    LOC_B,
  ]);
  await act(async () => rows[2].props.onPress());
  expect(sheet().props.visible).toBe(false);
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME04-10933',
    sourceRoute: 'Início',
  });
});

it('reports a failed share with a snackbar', async () => {
  mockShare.mockRejectedValueOnce(new Error('boom'));
  await render();
  await act(async () =>
    pressable('Compartilhar grade da semana').props.onPress(),
  );
  expect(mockShare).toHaveBeenCalled();
  expect(mockToast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
});

it('shows a skeleton instead of a spinner while nothing has loaded', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  mockGrades = makeQuery<ClassGrade[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  mockRid = makeQuery<PartialRidResult>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  await render();
  expect(renderer.root.findAllByType(HomeSkeleton)).toHaveLength(1);
  expect(renderer.root.findAllByType(EmptyState)).toHaveLength(0);
});

it('says the period has not started when there is nothing yet', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
  mockGrades = makeQuery<ClassGrade[]>([]);
  await render();
  const empty = renderer.root.findByType(EmptyState);
  expect(empty.props.text).toBe('Parece que o período não se iniciou ainda.');
  expect(empty.props.icon).toBe('event_upcoming');
});

it('explains a blocked portal without saved data and retries', async () => {
  const blocked = new AppError('POSSIBLY_BLOCKED');
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    error: blocked,
  });
  mockGrades = makeQuery<ClassGrade[]>(undefined, { error: blocked });
  mockRid = makeQuery<PartialRidResult>(undefined, { error: blocked });
  await render();
  const empty = renderer.root.findByType(EmptyState);
  expect(empty.props.icon).toBe('lock');
  expect(empty.props.tone).toBe('bad');
  expect(empty.props.text).toContain('temporariamente bloqueado');
  await act(async () => empty.props.action.onPress());
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
  expect(mockRid.refetch).toHaveBeenCalled();
});

it('keeps saved data visible under a single blocked notice', async () => {
  const blocked = new AppError('POSSIBLY_BLOCKED');
  mockSchedule = makeQuery(schedule, { error: blocked });
  mockGrades = makeQuery(grades, { error: blocked });
  await render();
  const notices = renderer.root.findAllByType(Notice);
  expect(notices).toHaveLength(1);
  expect(notices[0].props.kind).toBe('blocked');
  expect(texts()).toContain('O Aluno Online está temporariamente bloqueado.');
  await act(async () => notices[0].props.onRetry());
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
  expect(texts()).toContain('Olá, Marina');
  expect(renderer.root.findAllByType(TableRow)).toHaveLength(3);
});

it('shows one offline notice for all the saved data', async () => {
  mockOnline = false;
  await render();
  const notices = renderer.root.findAllByType(Notice);
  expect(notices).toHaveLength(1);
  expect(notices[0].props.kind).toBe('offline');
  expect(notices[0].props.text).toContain(
    'Sem conexão. Exibindo os últimos dados salvos.',
  );
});

it('does not keep the pull-to-refresh spinner going while offline', async () => {
  mockOnline = false;
  const never = () => new Promise<void>(() => undefined);
  mockSchedule = makeQuery(schedule, { refetch: jest.fn(never) });
  mockGrades = makeQuery(grades, { refetch: jest.fn(never) });
  mockRid = makeQuery<PartialRidResult>(
    { subjects: [], updatedAt: '' },
    { refetch: jest.fn(never) },
  );
  await render();
  const control = () =>
    renderer.root.find(
      node =>
        typeof node.props.onRefresh === 'function' &&
        'refreshing' in node.props,
    );
  await act(async () => control().props.onRefresh());
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(control().props.refreshing).toBe(false);
});

it('keeps the day timeline visible when the schedule arrives after mount', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  await render();
  mockSchedule = makeQuery(schedule);
  await act(async () => {
    renderer.update(
      <ThemeProvider theme={LIGHT}>
        <HomePage />
      </ThemeProvider>,
    );
  });
  expect(texts()).toContain('Livre · 1h50');
  const hidden = renderer.root.findAll(
    node =>
      (node.type as unknown) === 'View' &&
      StyleSheet.flatten(node.props.style)?.opacity === 0,
  );
  expect(hidden).toHaveLength(0);
});

it('shows the error card and the help when several parts fail', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  mockGrades = makeQuery<ClassGrade[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await render();
  const error = renderer.root.findByType(ErrorState);
  expect(error.props.variant).toBe('card');
  expect(error.props.message).toBe(
    'Ops, parece que houve um erro nos seguintes componentes: Grade de Horários, Quadro de notas. Toque aqui para tentar novamente.',
  );
  expect(texts()).toContain('Caso o erro persista');
  await act(async () => error.props.onRetry());
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
});

it('shows the partial RID during enrollment, with the queue status spelled out', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
  mockGrades = makeQuery<ClassGrade[]>([]);
  mockRid = makeQuery(rid);
  await render();
  expect(texts()).toContain('RID Parcial');
  expect(texts()).toContain('Última atualização em 12/08/2026 14:32');
  expect(texts()).toContain('Sem posição');
  expect(texts()).toContain('Indeferida: choque de horário');
  expect(texts()).toContain('Situação: Deferida');
  const row = pressable(
    'Sistemas Distribuídos, IME02-10892, Turma 2. Solicitadas/Oferecidas: 38 de 40, Crítico. Sua posição: 12, Bom. Situação: Deferida',
  );
  await act(async () => row.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME02-10892',
    sourceRoute: 'Início',
  });
});

it('presents what is new in a sheet once per version', async () => {
  await render();
  const sheets = renderer.root.findAllByType(BottomSheet);
  const whatsNew = sheets.find(
    s => s.props.title === 'Funcionalidades exclusivas',
  );
  expect(whatsNew?.props.visible).toBe(true);
  expect(texts()).toContain('O que o AO UERJ faz além do Aluno Online:');
});
