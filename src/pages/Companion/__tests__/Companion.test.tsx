import React from 'react';
import { Platform } from 'react-native';
import {
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import { CompanionWatch } from '@root/modules/companion/application/CompanionWatch';
import type {
  CompanionServerPort,
  MembershipStorePort,
} from '@root/modules/companion/application/ports';
import type {
  CompanionCall,
  MemberCall,
  Membership,
} from '@root/modules/companion/domain/companion';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { CompanionPage } from '../Companion';

const MINUTE = 60_000;
// segunda, 23 de novembro de 2026
let mockNow = new Date(2026, 10, 23, 12, 5);
const at = (h: number, m: number) => new Date(2026, 10, 23, h, m).getTime();

const lesson = (
  name: string,
  start: [string, number],
  end: [string, number],
  room: string,
): AttendedClassesSchedule => ({
  class: {
    id: name,
    name,
    class: '1',
    avaLocation: '',
    uerjLocation: `Pav. João Lyra Filho · 6º andar · ${room}`,
    status: 'ACTIVE',
  },
  dayAlias: 'Seg',
  dayNumber: 1,
  subject_id: name,
  periodAlias: 'T3',
  startTimeAlias: start[0],
  endTimeAlias: end[0],
  start_time_in_minutes: start[1],
  end_time_in_minutes: end[1],
});
const mockSchedule = {
  data: [
    lesson('Cálculo II', ['14:20', 860], ['16:00', 960], 'Sala 6019 B'),
    lesson(
      'Cinema Brasileiro',
      ['20:30', 1230],
      ['22:10', 1330],
      'Sala 9027 D',
    ),
  ],
};

const call = (extra: Partial<CompanionCall>): CompanionCall => ({
  id: 'a1',
  kind: 'lunch',
  at: at(12, 15),
  spot: 'ru',
  destination: null,
  note: 'Mesa perto da entrada.',
  host: 'Júlia',
  going: 2,
  capacity: 6,
  listedUntil: at(12, 45),
  expiresAt: at(12, 45),
  ...extra,
});
const inside = (base: CompanionCall, extra: Partial<MemberCall> = {}) => ({
  ...base,
  going: base.going + 1,
  endedAt: null,
  members: [
    { ref: 'ref-host001', name: base.host, host: true, you: false },
    { ref: 'ref-lucas01', name: 'Lucas', host: false, you: false },
    { ref: 'ref-marina1', name: 'Marina', host: false, you: true },
  ],
  feed: [],
  ...extra,
});

/** O mesmo objeto a cada leitura, como o `useSyncExternalStore` espera. */
const NOTIFICATIONS = { supported: true, permission: 'granted' };
let mockServer: Record<keyof CompanionServerPort, jest.Mock>;
let mockStored: Membership[];
let mockServices: Record<string, unknown>;

function services() {
  mockStored = [];
  const store: MembershipStorePort = {
    read: async () => mockStored,
    write: async memberships => {
      mockStored = [...memberships];
    },
  };
  mockServer = {
    pass: jest.fn(async () => ({ pass: 'p', expiresAt: at(13, 5) })),
    list: jest.fn(async () => ({
      watching: 1,
      calls: [
        call({}),
        call({
          id: 'a2',
          at: at(12, 30),
          spot: 'lago',
          note: '',
          host: 'Diego',
          going: 1,
        }),
        call({
          id: 'v1',
          kind: 'home',
          at: at(22, 15),
          spot: 'concha',
          destination: 'metro',
          listedUntil: at(22, 25),
          expiresAt: at(24, 15),
        }),
      ],
    })),
    open: jest.fn(async request => ({
      call: {
        ...call({ id: 'mine', ...request, host: request.name, going: 1 }),
        note: request.note,
        endedAt: null,
        members: [
          { ref: 'ref-mine001', name: request.name, host: true, you: true },
        ],
        feed: [],
      },
      memberKey: 'k-mine',
    })),
    join: jest.fn(async (callId: string) => ({
      call: inside(call({ id: callId })),
      memberKey: `k-${callId}`,
    })),
    read: jest.fn(async (callId: string) => inside(call({ id: callId }))),
    leave: jest.fn(async () => undefined),
    say: jest.fn(async (callId: string) =>
      inside(call({ id: callId }), {
        feed: [
          { name: 'Marina', phrase: 'on_my_way', at: at(12, 6), you: true },
        ],
      }),
    ),
    remove: jest.fn(async (callId: string) =>
      inside(call({ id: callId }), {
        going: 2,
        members: [
          { ref: 'ref-mine001', name: 'Marina', host: true, you: true },
          { ref: 'ref-julia01', name: 'Júlia', host: false, you: false },
        ],
      }),
    ),
    report: jest.fn(async () => undefined),
  };
  mockServices = {
    companion: new CompanionCalls({
      server: mockServer,
      store,
      now: () => mockNow.getTime(),
    }),
    campusMap: new CampusMap(bundledCampusMap),
    preferences: {
      read: jest.fn(async () => null),
      write: jest.fn(async () => undefined),
    },
    notifications: {
      settings: {
        subscribe: () => () => undefined,
        getSnapshot: () => NOTIFICATIONS,
        requestPermission: jest.fn(),
        openSettings: jest.fn(),
      },
    },
  };
}

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({
    status: 'signedIn',
    account: {
      scope: 'account-1',
      name: 'MARINA ALBUQUERQUE TEIXEIRA',
      matricula: '209912345678',
      period: '2026.2',
    },
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn() }),
    useRoute: () => ({ params: undefined }),
    useIsFocused: () => true,
    // a tela está sempre na frente
    useFocusEffect: (effect: () => void | (() => void)) =>
      ReactModule.useEffect(effect, [effect]),
  };
});
jest.mock('@features/AttendedClassesSchedule/useNow', () => ({
  useNow: () => mockNow,
}));
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useSchedule: () => mockSchedule,
}));
jest.mock('@root/modules/academics/presentation/QueryNotice', () => ({
  QueryNotice: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// o convite só existe onde o app está numa loja
let mockCanInvite = false;
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  ...jest.requireActual('@root/modules/delivery/presentation/DeliveryProvider'),
  useCanInvite: () => mockCanInvite,
}));

const renderPage = () =>
  renderWithProviders(<CompanionPage />, {
    queryClient: createTestQueryClient(),
  });

beforeEach(() => {
  mockNow = new Date(2026, 10, 23, 12, 5);
  mockCanInvite = false;
  services();
});

it('lists the tables open in the free window from the schedule, with only the host first name', async () => {
  await renderPage();
  expect(await screen.findByText('Mesa no RU, 12:15')).toBeOnTheScreen();
  expect(screen.getByText('Você está livre até 14:20')).toBeOnTheScreen();
  expect(screen.getByText('Depois: Cálculo II, Sala 6019 B')).toBeOnTheScreen();
  expect(
    screen.getByText('Mesa no Lago dos Peixinhos, 12:30'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Júlia · 2 vão')).toBeOnTheScreen();
  // a volta da noite fica na outra aba
  expect(screen.queryByText('Grupo para o metrô, 22:15')).not.toBeOnTheScreen();
  // um passe para a lista, sem nome nem matrícula
  expect(mockServer.pass).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Marina')).toBeOnTheScreen();
});

it('joins with one tap and opens the call with the names and the ready phrases', async () => {
  const success = jest.spyOn(snackbar, 'success');
  const user = userEvent.setup();
  await renderPage();
  await user.press(
    await screen.findByRole('button', {
      name: 'Sentar junto: Mesa no RU, 12:15',
    }),
  );
  expect(mockServer.join).toHaveBeenCalledWith('a1', 'Marina');
  expect(success).toHaveBeenCalledWith(
    'Você vai sentar junto',
    'Encontro: Restaurante Universitário (RU), 12:15.',
  );
  expect(await screen.findByText('Júlia, Lucas e você')).toBeOnTheScreen();
  expect(mockStored.map(item => [item.callId, item.memberKey])).toEqual([
    ['a1', 'k-a1'],
  ]);

  await user.press(screen.getByRole('button', { name: 'Estou indo' }));
  expect(mockServer.say).toHaveBeenCalledWith('a1', 'k-a1', 'on_my_way');
  expect(await screen.findByText('Você: Estou indo')).toBeOnTheScreen();
  // sem a cancela "Cheguei em casa" na mesa
  expect(
    screen.queryByRole('button', { name: 'Cheguei em casa' }),
  ).not.toBeOnTheScreen();
});

it('refuses a note with a contact before sending and opens the table', async () => {
  const user = userEvent.setup();
  await renderPage();
  await screen.findByText('Mesa no RU, 12:15');
  await user.press(screen.getAllByRole('button', { name: 'Abrir mesa' })[0]);
  expect(await screen.findByText('Abrir uma mesa')).toBeOnTheScreen();
  expect(screen.getByText('12:15')).toBeOnTheScreen();

  await user.type(
    screen.getByLabelText('Recado (opcional)'),
    'chama no insta @marina',
  );
  const [, submit] = screen.getAllByRole('button', { name: 'Abrir mesa' });
  await user.press(submit);
  expect(
    await screen.findByText(
      'Telefone, @ e links ficam fora: combine aqui só o encontro.',
    ),
  ).toBeOnTheScreen();
  expect(mockServer.open).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText('Recado (opcional)'));
  await user.type(screen.getByLabelText('Recado (opcional)'), 'Mesa do fundo');
  await user.press(screen.getAllByRole('button', { name: 'Abrir mesa' })[1]);
  await waitFor(() => expect(mockServer.open).toHaveBeenCalled());
  expect(mockServer.open.mock.calls[0][0]).toEqual({
    kind: 'lunch',
    at: at(12, 15),
    spot: 'ru',
    destination: null,
    note: 'Mesa do fundo',
    capacity: 6,
    name: 'Marina',
  });
  expect(
    await screen.findByText('Você abriu', { exact: false }),
  ).toBeOnTheScreen();
  expect(mockStored[0]).toMatchObject({ callId: 'mine', host: true });
});

it('starts on the way home after the last class, and says when nobody called yet', async () => {
  mockNow = new Date(2026, 10, 23, 22, 30);
  mockServer.list.mockResolvedValue({ calls: [], watching: 1 });
  await renderPage();
  expect(
    await screen.findByText('Nenhum grupo para voltar ainda'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Sua última aula acabou às 22:10')).toBeOnTheScreen();
  expect(screen.getByText('Grupos para voltar')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Convidar a turma' })).toBeNull();
});

it('invites the class when nobody opened a table yet', async () => {
  mockCanInvite = true;
  mockServer.list.mockResolvedValue({ calls: [], watching: 0 });
  await renderPage();
  expect(
    await screen.findByText('Quanto mais gente, mais mesas no almoço.'),
  ).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Convidar a turma' }));
  expect(await screen.findByText('Indicar o AO UERJ')).toBeOnTheScreen();
  expect(
    screen.getByText(/dá pra abrir uma mesa no almoço ou um grupo pra voltar/),
  ).toBeOnTheScreen();
});

it('explains when the app cannot prove the student yet, in the words of each system', async () => {
  mockServer.pass.mockRejectedValue(new AppError('STUDENT_PROOF_UNAVAILABLE'));
  // o Jest roda como iPhone: lá, a confirmação passa pela Apple
  await renderPage();
  expect(
    await screen.findByText('Confirmando que você é aluno'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Leva alguns segundos. Sem internet, não dá para confirmar.',
    ),
  ).toBeOnTheScreen();
  await screen.unmount();

  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  try {
    await renderPage();
    expect(
      await screen.findByText(
        'Leva alguns segundos. Sem a Play Store no celular, não dá para confirmar.',
      ),
    ).toBeOnTheScreen();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  }
});

it('says who gets in in one line, and the rest only under "Como funciona"', async () => {
  await renderPage();
  const note = await screen.findByRole('button', {
    name: 'Só alunos da UERJ. Como funciona',
  });
  expect(screen.queryByText(/a moderação vê quem é/)).toBeNull();
  const user = userEvent.setup();
  await user.press(note);
  expect(
    await screen.findByRole('header', { name: 'Como funciona' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Os outros veem só o seu primeiro nome.'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Se alguém denunciar, a moderação vê quem é.'),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Entendi' }));
  await waitFor(() =>
    expect(screen.queryByText(/a moderação vê quem é/)).toBeNull(),
  );
});

it('shows the way home in steps, and only the count to who is outside', async () => {
  mockNow = new Date(2026, 10, 23, 22, 0);
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByText('Grupo para o metrô, 22:15'));
  expect(await screen.findByText('Saída pelo Portão 1')).toBeOnTheScreen();
  expect(
    screen.getByText('Estação Maracanã · Metrô Linha 2'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('2 vão. Os nomes aparecem depois que você entrar', {
      exact: false,
    }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Entrar no grupo' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('image', {
      name: 'Mapa: Concha Acústica, saída pelo Portão 1, Estação Maracanã · Metrô Linha 2',
    }),
  ).toBeOnTheScreen();
  expect(mockNow.getTime() + MINUTE).toBeGreaterThan(0);
});

it('lets the student type another time, within 3 hours, and warns about a class then', async () => {
  const user = userEvent.setup();
  await renderPage();
  await screen.findByText('Mesa no RU, 12:15');
  await user.press(screen.getAllByRole('button', { name: 'Abrir mesa' })[0]);
  await user.press(
    await screen.findByRole('togglebutton', { name: 'Outro horário' }),
  );
  const field = screen.getByLabelText('Começa às');

  // 16:00 passa das 3 horas: o botão espera
  await fireEvent.changeText(field, '1600');
  expect(
    await screen.findByText(
      'Dá para abrir até 3 horas à frente, no mesmo dia: escolha até as 15:04.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getAllByRole('button', { name: 'Abrir mesa' })[1],
  ).toBeDisabled();

  // 15:00 cabe, mas cai na aula de Cálculo II: o app avisa e deixa abrir
  await fireEvent.changeText(field, '1500');
  expect(
    await screen.findByText(
      'Nesse horário você está em aula: Cálculo II, até 16:00.',
    ),
  ).toBeOnTheScreen();
  await user.press(screen.getAllByRole('button', { name: 'Abrir mesa' })[1]);
  await waitFor(() => expect(mockServer.open).toHaveBeenCalled());
  expect(mockServer.open.mock.calls[0][0]).toMatchObject({
    kind: 'lunch',
    at: at(15, 0),
  });
});

it('with nobody open, says who is watching and asks for a heads-up in the free window', async () => {
  const user = userEvent.setup();
  const device = {
    requestPermission: jest.fn(async () => 'granted' as const),
    notify: jest.fn(async () => undefined),
    setCompanionWatch: jest.fn(async (_on: boolean) => undefined),
    setCampusWatch: jest.fn(async (_on: boolean) => undefined),
  };
  const saved = new Map<string, unknown>();
  mockServices.notifications = {
    ...(mockServices.notifications as object),
    companionWatch: new CompanionWatch({
      device,
      store: {
        read: async <T,>(_scope: string, key: string) =>
          (saved.get(key) as T) ?? null,
        write: async (_scope: string, key: string, value: unknown) => {
          saved.set(key, value);
        },
      },
      account: () => ({ scope: 'account-1' }),
      savedScope: async () => 'account-1',
      disabled: () => false,
      list: async () => ({ calls: [] }),
      memberships: async () => [],
      message: () => {
        throw new Error('sem aviso aqui');
      },
      now: () => mockNow.getTime(),
    }),
  };
  mockServer.list.mockResolvedValue({ calls: [], watching: 13 });
  await renderPage();
  expect(
    await screen.findByText(
      '12 alunos de olho agora. Abra você: quem estiver livre no mesmo horário vê na hora.',
    ),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: 'Me avise se tiver mesa' }),
  );
  expect(device.setCompanionWatch).toHaveBeenCalledWith(true);
  // até 40 minutos antes da aula das 14:20
  expect(
    await screen.findByText(
      'Se alguém abrir uma mesa até as 13:40, o app avisa.',
    ),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Cancelar o aviso' }));
  expect(device.setCompanionWatch).toHaveBeenLastCalledWith(false);
});

it('offers to sit at the table already open at that time instead of opening another', async () => {
  const user = userEvent.setup();
  await renderPage();
  await screen.findByText('Mesa no RU, 12:15');
  await user.press(screen.getAllByRole('button', { name: 'Abrir mesa' })[0]);
  // a primeira mesa da folha é às 12:15, no RU: a da Júlia
  expect(
    await screen.findByText(
      'Mesa no RU, 12:15 já está aberta: Júlia abriu, 2 vão.',
      { exact: false },
    ),
  ).toBeOnTheScreen();
  // o botão da lista se chama "Sentar junto: Mesa no RU, 12:15"; o do aviso, só "Sentar junto"
  await user.press(screen.getByRole('button', { name: 'Sentar junto' }));
  await waitFor(() =>
    expect(mockServer.join).toHaveBeenCalledWith('a1', 'Marina'),
  );
  expect(mockServer.open).not.toHaveBeenCalled();
});

it('lets the host remove someone, after confirming', async () => {
  const user = userEvent.setup();
  mockStored = [
    {
      callId: 'a1',
      memberKey: 'k-a1',
      host: true,
      kind: 'lunch',
      at: at(12, 15),
      spot: 'ru',
      destination: null,
      expiresAt: at(12, 45),
    },
  ];
  mockServer.read.mockImplementation(async (callId: string) =>
    inside(call({ id: callId, host: 'Marina' }), {
      members: [
        { ref: 'ref-mine001', name: 'Marina', host: true, you: true },
        { ref: 'ref-julia01', name: 'Júlia', host: false, you: false },
        { ref: 'ref-lucas01', name: 'Lucas', host: false, you: false },
      ],
    }),
  );
  await renderPage();
  await user.press(await screen.findByText('Mesa no RU, 12:15'));
  await user.press(
    await screen.findByRole('button', { name: 'Tirar Júlia da mesa' }),
  );
  expect(await screen.findByText('Tirar Júlia da mesa?')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Tirar' }));
  await waitFor(() =>
    expect(mockServer.remove).toHaveBeenCalledWith('a1', 'k-a1', 'ref-julia01'),
  );
  // quem abriu não tem "Tirar"
  expect(
    screen.queryByRole('button', { name: 'Tirar Marina da mesa' }),
  ).not.toBeOnTheScreen();
});
