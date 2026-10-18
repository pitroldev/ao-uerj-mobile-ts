import React from 'react';
import {
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';

import { LIGHT } from '@root/themes';
import { AppError } from '@root/shared/errors/AppError';
import type {
  AttendedClassesSchedule,
  ClassGrade,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import { snackbar, type IconName } from '@components/ui';
import { OUTLINED_GLYPHS } from '@components/ui/Icon/glyphs';
import { renderWithProviders } from '@root/test-utils/render';
import { HomePage } from '../Home';

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
  // sem suporte a avisos: o convite de lembretes tem teste próprio
  notifications: {
    settings: {
      subscribe: () => () => undefined,
      getSnapshot: () => mockNotifications,
    },
  },
};
const mockNotifications = { supported: false };
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

const renderHome = () => renderWithProviders(<HomePage />);
/**
 * Folha aberta com este título. A folha é um `Modal`, que só fica na árvore
 * enquanto está aberto (o mock do preset devolve `null` com `visible` falso,
 * e a folha desmonta o `Modal` depois da animação de saída).
 */
const sheet = (title: string) =>
  screen.container
    .queryAll(node => node.type === 'Modal')
    .find(modal => within(modal).queryByRole('header', { name: title })) ??
  null;
/**
 * Ícones sem rótulo são decorativos (fora da acessibilidade): confere o
 * glifo desenhado.
 */
const drawsIcon = (name: IconName) =>
  screen.container.queryAll(node => node.props.d === OUTLINED_GLYPHS[name])
    .length > 0;
/** Rolagem do painel (a que contém a saudação), dona do puxar para atualizar. */
const panelScroll = () => {
  let node = screen.getByRole('header', { name: 'Olá, Marina' }).parent;
  while (node && node.type !== 'RCTScrollView') node = node.parent;
  return node!;
};
const RETRY = { name: 'Tentar novamente' };
const NOT_STARTED = 'Parece que o período não se iniciou ainda.';

beforeEach(() => {
  mockOnline = true;
  mockSchedule = makeQuery(schedule);
  mockGrades = makeQuery(grades);
  mockRid = makeQuery<PartialRidResult>({ subjects: [], updatedAt: '' });
});

afterEach(() => {
  mockNavigate.mockClear();
  mockShare.mockReset();
});

it('greets the student and answers the next class first', async () => {
  await renderHome();
  expect(screen.getByRole('header', { name: 'Olá, Marina' })).toBeOnTheScreen();
  // a data de hoje aparece na saudação e no dia aberto da semana
  expect(screen.getAllByText('Terça, 13 de outubro')).toHaveLength(2);
  expect(screen.getByText('Hoje · em 22 min')).toBeOnTheScreen();
  const next = screen.getByRole('button', {
    name: 'Otimização Combinatória, 12:20 às 14:10, Sala 6019 B. Ver disciplinas em curso',
  });
  expect(within(next).getByText('T1–T2 · Sala 6019 B')).toBeOnTheScreen();
  expect(
    within(next).getByText('Pav. João Lyra Filho · 6º andar'),
  ).toBeOnTheScreen();
});

it('lists the grades with health spelled out, never by color alone', async () => {
  await renderHome();
  const rows = screen.getAllByLabelText(/: P1 /);
  const labels = [
    'Sistemas Distribuídos: P1 8,5, P2 sem nota, PF sem nota, Média sem nota. Bom na P1',
    'Compiladores: P1 6,0, P2 sem nota, PF sem nota, Média sem nota. Atenção na P1',
    'Ética e Computação: P1 sem nota, P2 sem nota, PF sem nota, Média 9,0. Bom na média',
  ];
  expect(rows).toHaveLength(labels.length);
  rows.forEach((row, i) => expect(row).toHaveAccessibleName(labels[i]));
  expect(screen.getByText('Atenção: 5 a 6,9')).toBeOnTheScreen();
});

it('shows today as a timeline with the free gap, the now line and finished classes', async () => {
  await renderHome();
  expect(screen.getByText('2 aulas')).toBeOnTheScreen();
  expect(screen.getByText('Hoje')).toBeOnTheScreen();
  expect(screen.getByText('Livre · 1h50')).toBeOnTheScreen();
  expect(screen.getByLabelText('Agora, 11:58')).toBeOnTheScreen();
  const finished = screen.getByRole('button', {
    name: 'Compiladores, 8:50 às 10:30, M3–M4, Sala 6113 D, encerrada',
  });
  expect(within(finished).getByText('Encerrada')).toBeOnTheScreen();
});

it('switches days and marks canceled classes with a label', async () => {
  const user = userEvent.setup();
  await renderHome();
  await user.press(screen.getByRole('tab', { name: 'Sábado, 17 de outubro' }));
  expect(screen.getByText('Sábado, 17 de outubro')).toBeOnTheScreen();
  const canceled = screen.getByRole('button', {
    name: 'Computação Gráfica, 8:50 às 10:30, M3–M4, cancelada',
  });
  expect(within(canceled).getByText('Cancelada')).toBeOnTheScreen();
  await user.press(
    screen.getByRole('tab', { name: 'Sexta, 16 de outubro, sem aulas' }),
  );
  expect(screen.getByText('Sem aulas neste dia.')).toBeOnTheScreen();
});

it('opens the classes sheet focused on the tapped class and navigates from it', async () => {
  const user = userEvent.setup();
  await renderHome();
  const classes = () => sheet('Disciplinas em Curso');
  expect(classes()).not.toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', {
      name: 'Otimização Combinatória, 12:20 às 14:10, T1–T2, Sala 6019 B, Tarde',
    }),
  );
  const open = classes();
  expect(open).toBeOnTheScreen();
  expect(within(open!).getByText('3 ativas')).toBeOnTheScreen();
  const rows = within(open!).getAllByHintText('Abre a Pesquisa de Disciplinas');
  const titles = [
    'Sistemas Distribuídos',
    'Compiladores',
    'Otimização Combinatória',
    'Computação Gráfica',
  ];
  expect(rows).toHaveLength(titles.length);
  rows.forEach((row, i) => {
    expect(within(row).getByText(titles[i])).toBeOnTheScreen();
    // só a aula tocada fica destacada, com o fundo de acento suave
    expect(row).toHaveStyle({
      backgroundColor: i === 2 ? LIGHT.colors.accentSoft : 'transparent',
    });
  });
  expect(
    within(rows[2]).getByText('Ter e Qui · T1–T2 · 12:20–14:10'),
  ).toBeOnTheScreen();
  expect(within(rows[2]).getByText(LOC_B)).toBeOnTheScreen();
  await user.press(rows[2]);
  await waitFor(() => expect(classes()).not.toBeOnTheScreen());
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME04-10933',
    sourceRoute: 'Início',
  });
});

it('reports a failed share with a snackbar', async () => {
  const showError = jest.spyOn(snackbar, 'error');
  mockShare.mockRejectedValueOnce(new Error('boom'));
  await renderHome();
  await userEvent
    .setup()
    .press(
      screen.getByRole('button', { name: 'Compartilhar grade da semana' }),
    );
  expect(mockShare).toHaveBeenCalled();
  expect(showError).toHaveBeenCalledWith(
    'Não foi possível compartilhar a grade.',
    'Tente novamente.',
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
  await renderHome();
  expect(screen.getByLabelText('Carregando dados…')).toBeBusy();
  expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
  // nenhum estado vazio: nem "não começou" nem bloqueado/erro
  expect(screen.queryByText(NOT_STARTED)).not.toBeOnTheScreen();
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

it('says the period has not started when there is nothing yet', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
  mockGrades = makeQuery<ClassGrade[]>([]);
  await renderHome();
  expect(screen.getByText(NOT_STARTED)).toBeOnTheScreen();
  expect(drawsIcon('event_upcoming')).toBe(true);
});

it('explains a blocked portal without saved data and retries', async () => {
  const blocked = new AppError('POSSIBLY_BLOCKED');
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    error: blocked,
  });
  mockGrades = makeQuery<ClassGrade[]>(undefined, { error: blocked });
  mockRid = makeQuery<PartialRidResult>(undefined, { error: blocked });
  await renderHome();
  // tom crítico: a mensagem é anunciada como alerta, ao lado do cadeado
  expect(screen.getByRole('alert')).toHaveTextContent(
    /temporariamente bloqueado/,
  );
  expect(drawsIcon('lock')).toBe(true);
  await userEvent.setup().press(screen.getByRole('button', RETRY));
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
  expect(mockRid.refetch).toHaveBeenCalled();
});

it('keeps saved data visible under a single blocked notice', async () => {
  const blocked = new AppError('POSSIBLY_BLOCKED');
  mockSchedule = makeQuery(schedule, { error: blocked });
  mockGrades = makeQuery(grades, { error: blocked });
  await renderHome();
  // um só aviso (um só "Tentar novamente"), do tipo `blocked`: tom crítico
  // (alerta), cadeado e o texto padrão
  expect(screen.getAllByRole('button', RETRY)).toHaveLength(1);
  expect(
    screen.getByRole('alert', {
      name: 'O Aluno Online está temporariamente bloqueado.',
    }),
  ).toBeOnTheScreen();
  expect(drawsIcon('lock')).toBe(true);
  await userEvent.setup().press(screen.getByRole('button', RETRY));
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
  expect(screen.getByRole('header', { name: 'Olá, Marina' })).toBeOnTheScreen();
  expect(screen.getAllByLabelText(/: P1 /)).toHaveLength(3);
});

it('shows one offline notice for all the saved data', async () => {
  mockOnline = false;
  await renderHome();
  // um só aviso, do tipo `offline`: neutro (sem alerta) e com a nuvem riscada
  expect(screen.getAllByRole('button', RETRY)).toHaveLength(1);
  expect(
    screen.getByText(/^Sem conexão\. Exibindo os últimos dados salvos\./),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(drawsIcon('cloud_off')).toBe(true);
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
  await renderHome();
  await userEvent.setup().pullToRefresh(panelScroll());
  expect(mockSchedule.refetch).toHaveBeenCalled();
  // o RefreshControl simulado não repassa props: o estado fica no elemento
  // que o painel entrega ao ScrollView
  expect(panelScroll().props.refreshControl.props.refreshing).toBe(false);
});

it('keeps the day timeline visible when the schedule arrives after mount', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    isLoading: true,
    isFetching: true,
  });
  await renderHome();
  mockSchedule = makeQuery(schedule);
  await screen.rerender(<HomePage />);
  expect(screen.getByText('Livre · 1h50')).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: 'Compiladores, 8:50 às 10:30, M3–M4, Sala 6113 D, encerrada',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: 'Otimização Combinatória, 12:20 às 14:10, T1–T2, Sala 6019 B, Tarde',
    }),
  ).toBeVisible();
});

it('shows the error card and the help when several parts fail', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  mockGrades = makeQuery<ClassGrade[]>(undefined, {
    error: new AppError('NETWORK'),
  });
  await renderHome();
  const message = screen.getByRole('alert', {
    name: 'Ops, parece que houve um erro nos seguintes componentes: Grade de Horários, Quadro de notas. Toque aqui para tentar novamente.',
  });
  // variante `card`: caixa com fio e o ícone ao lado da mensagem (o estado
  // centralizado não tem borda e centraliza o texto)
  expect(message.parent?.parent).toHaveStyle({
    flexDirection: 'row',
    borderWidth: LIGHT.borders.hairline,
  });
  expect(message).not.toHaveStyle({ textAlign: 'center' });
  expect(
    screen.getByRole('header', { name: 'Caso o erro persista' }),
  ).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', RETRY));
  expect(mockSchedule.refetch).toHaveBeenCalled();
  expect(mockGrades.refetch).toHaveBeenCalled();
});

it('shows the partial RID during enrollment, with the queue status spelled out', async () => {
  mockSchedule = makeQuery<AttendedClassesSchedule[]>([]);
  mockGrades = makeQuery<ClassGrade[]>([]);
  mockRid = makeQuery(rid);
  await renderHome();
  expect(screen.getByRole('header', { name: 'RID Parcial' })).toBeOnTheScreen();
  expect(
    screen.getByText('Última atualização em 12/08/2026 14:32'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Sem posição')).toBeOnTheScreen();
  expect(screen.getByText('Indeferida: choque de horário')).toBeOnTheScreen();
  expect(screen.getByText('Situação: Deferida')).toBeOnTheScreen();
  await userEvent.setup().press(
    screen.getByRole('button', {
      name: 'Sistemas Distribuídos, IME02-10892, Turma 2. Solicitadas/Oferecidas: 38 de 40, Crítico. Sua posição: 12, Bom. Situação: Deferida',
    }),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Pesquisa de Disciplinas', {
    subjectId: 'IME02-10892',
    sourceRoute: 'Início',
  });
});

it('presents what is new in a sheet once per version', async () => {
  await renderHome();
  expect(
    await screen.findByRole('header', { name: 'Funcionalidades exclusivas' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('O que o AO UERJ faz além do Aluno Online:'),
  ).toBeOnTheScreen();
  // sem avisos no aparelho (iOS), a novidade da versão não aparece
  expect(screen.queryByText('Notificações')).toBeNull();
});

it('lists the notifications as new where the device has them', async () => {
  mockNotifications.supported = true;
  try {
    await renderHome();
    expect(
      await screen.findByLabelText(/^Notificações, novo\. Lembrete antes/),
    ).toBeOnTheScreen();
  } finally {
    mockNotifications.supported = false;
  }
});
