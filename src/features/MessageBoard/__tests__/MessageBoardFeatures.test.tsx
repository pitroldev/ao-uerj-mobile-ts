import React from 'react';
import { Platform, ScrollView } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import Clipboard from '@react-native-clipboard/clipboard';

import { LIGHT } from '@root/themes';
import { snackbar } from '@components/ui';
import type { Message } from '@root/modules/community/domain/models';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { SubjectChat } from '../SubjectChat';
import { SubjectList } from '../SubjectList';
import { dayLabel } from '../chatFormat';

const mockMessages = jest.fn();
const mockPost = jest.fn();
let mockSchedule: {
  data?: unknown;
  error?: unknown;
  isLoading?: boolean;
  isFetching?: boolean;
  isPaused?: boolean;
  dataUpdatedAt?: number;
  refetch: jest.Mock;
};
const ACCOUNT = {
  scope: 'account-a',
  name: 'Marina Albuquerque',
  matricula: '202310045612',
  period: '2026.2',
};

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    community: { messages: mockMessages, postMessage: mockPost },
  }),
  useIdentity: () => ({ status: 'signedIn', account: ACCOUNT, error: null }),
}));
jest.mock('@root/modules/academics/presentation/queries', () => ({
  ...jest.requireActual('@root/modules/academics/presentation/queries'),
  useSchedule: () => mockSchedule,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

const SUBJECT = {
  id: 'IME02-10892',
  name: 'Sistemas Distribuídos',
  class: '2',
  avaLocation: '',
  uerjLocation: '',
  status: 'ACTIVE',
};
const day = (offset: number, hour: number, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const message = (
  id: string,
  date: Date,
  authorName: string,
  text: string,
): Message => ({
  id,
  authorName,
  subjectId: SUBJECT.id,
  classNumber: SUBJECT.class,
  period: ACCOUNT.period,
  text,
  createdAt: date.toISOString(),
});
const THREAD = [
  message(
    'm1',
    day(4, 21, 14),
    'Lucas Ferreira',
    'Galera, criei o grupo da turma 2: https://chat.whatsapp.com/exemplo',
  ),
  message('m2', day(3, 8, 2), 'Beatriz Nunes', 'P2 confirmada para 24/11.'),
  message('m3', day(3, 8, 15), 'Marina Albuquerque', 'Alguém tem os slides?'),
];

let client: QueryClient;
const renderChat = () =>
  renderWithProviders(<SubjectChat {...SUBJECT} />, { queryClient: client });
const renderList = (onSubjectPress: jest.Mock = jest.fn()) =>
  renderWithProviders(<SubjectList onSubjectPress={onSubjectPress} />, {
    queryClient: client,
  });
/** A conversa carregou: a primeira mensagem da turma está na tela. */
const threadLoaded = () => screen.findByText('Lucas Ferreira');
/** Deixa passar um quadro (a conversa repete a rolagem até o fim no seguinte). */
const nextFrame = () =>
  act(
    () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
  );
/** Rolagem da conversa: 1000 de conteúdo numa área visível de 400. */
const scrollChat = (y: number) =>
  fireEvent.scroll(screen.getByTestId('chat-scroll'), {
    nativeEvent: {
      contentOffset: { y },
      contentSize: { height: 1000 },
      layoutMeasurement: { height: 400 },
    },
  });

beforeEach(() => {
  onlineManager.setOnline(true);
  client = createTestQueryClient();
  mockMessages.mockReset().mockResolvedValue(THREAD);
  mockPost.mockReset().mockResolvedValue(THREAD[0]);
  mockSchedule = {
    data: [
      { class: SUBJECT },
      { class: SUBJECT },
      {
        class: {
          ...SUBJECT,
          id: 'IME02-10871',
          name: 'Compiladores',
          class: '1',
        },
      },
      {
        class: {
          ...SUBJECT,
          id: 'IME02-10905',
          name: 'Ética e Computação',
          status: 'CANCELED',
        },
      },
    ],
    error: null,
    isLoading: false,
    isFetching: false,
    isPaused: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  };
});
afterEach(() => {
  client.clear();
});

describe('subject chat', () => {
  it('shows the class header, day separators and own messages as "Você"', async () => {
    await renderChat();
    expect(await threadLoaded()).toBeOnTheScreen();
    expect(mockMessages).toHaveBeenCalledWith(
      { subjectId: SUBJECT.id, classNumber: '2', period: '2026.2' },
      expect.anything(),
    );
    expect(
      screen.getByRole('header', { name: 'Sistemas Distribuídos' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('IME02-10892 · Turma 2')).toBeOnTheScreen();
    const period = screen.getByRole('button', {
      name: 'Período das mensagens: 2026.2. Trocar',
    });
    expect(within(period).getByText('Período das mensagens')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: dayLabel(day(4, 21), new Date()) }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: dayLabel(day(3, 8), new Date()) }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Você')).toBeOnTheScreen();
    expect(screen.getByText('21:14')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Mensagem de você, 08:15. Alguém tem os slides?',
      }),
    ).toBeOnTheScreen();
  });

  describe('copying a message', () => {
    const originalOS = Platform.OS;
    const versionDescriptor = Object.getOwnPropertyDescriptor(
      Platform,
      'Version',
    );
    const setPlatform = (os: 'ios' | 'android', version: number) => {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
      Object.defineProperty(Platform, 'Version', {
        get: () => version,
        configurable: true,
      });
    };
    const copyMessage = async () => {
      await renderChat();
      await userEvent.setup().press(
        await screen.findByRole('button', {
          name: 'Mensagem de Beatriz Nunes, 08:02. P2 confirmada para 24/11.',
        }),
      );
      expect(Clipboard.setString).toHaveBeenCalledWith(
        'P2 confirmada para 24/11.',
      );
    };
    const showSuccess = jest.spyOn(snackbar, 'success');
    const expectCopiedSnackbar = () =>
      expect(showSuccess).toHaveBeenCalledWith(
        'Copiado com sucesso!',
        'O texto foi copiado para a área de transferência.',
      );

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
      if (versionDescriptor) {
        Object.defineProperty(Platform, 'Version', versionDescriptor);
      }
    });

    it('copies the tapped message and confirms it with a toast (iOS)', async () => {
      setPlatform('ios', 17);
      await copyMessage();
      expectCopiedSnackbar();
    });

    it('confirms it with a toast below Android 13 (API 32)', async () => {
      setPlatform('android', 32);
      await copyMessage();
      expectCopiedSnackbar();
    });

    it('leaves the confirmation to the system from Android 13 on (API 33)', async () => {
      setPlatform('android', 33);
      await copyMessage();
      expect(showSuccess).not.toHaveBeenCalled();
    });
  });

  it('sends the typed message and clears the composer', async () => {
    const user = userEvent.setup();
    await renderChat();
    await threadLoaded();
    const send = () => screen.getByRole('button', { name: 'Enviar mensagem' });
    expect(send()).toBeDisabled();
    await user.type(screen.getByLabelText('Mensagem'), '  Até amanhã  ');
    expect(send()).toBeEnabled();
    await user.press(send());
    await waitFor(() => expect(mockMessages).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenCalledWith(
      { subjectId: SUBJECT.id, classNumber: '2', period: '2026.2' },
      '  Até amanhã  ',
    );
    expect(screen.getByLabelText('Mensagem')).toHaveDisplayValue('');
  });

  it('keeps the keyboard up while sending and ignores a second send', async () => {
    const user = userEvent.setup();
    let delivered!: () => void;
    mockPost.mockReturnValueOnce(
      new Promise<Message>(resolve => {
        delivered = () => resolve(THREAD[0]);
      }),
    );
    await renderChat();
    await threadLoaded();
    const input = () => screen.getByLabelText('Mensagem');
    await user.type(input(), 'Até amanhã');
    await user.press(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(
      screen.getByRole('button', { name: 'Enviar mensagem' }),
    ).toBeDisabled();
    // desabilitar o campo tiraria o foco e fecharia o teclado
    expect(input()).toBeEnabled();
    // o "enviar" do teclado durante o envio não manda de novo
    await fireEvent(input(), 'submitEditing');
    // o aluno começa a próxima mensagem antes de o envio terminar
    await user.type(input(), ' Valeu!');
    await act(async () => delivered());
    await waitFor(() => expect(mockMessages).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(expect.anything(), 'Até amanhã');
    // sai do campo só o que foi enviado
    expect(input()).toHaveDisplayValue(' Valeu!');
  });

  it('follows the conversation to the sent message, even after scrolling up', async () => {
    const user = userEvent.setup();
    // instâncias do ScrollView simulado compartilham os métodos do protótipo
    const scrollToEnd = jest.mocked(ScrollView.prototype.scrollToEnd);
    await renderChat();
    await threadLoaded();
    const grow = async (height: number) => {
      await fireEvent(
        screen.getByTestId('chat-scroll'),
        'contentSizeChange',
        412,
        height,
      );
      await nextFrame();
    };

    // o aluno sobe para ler mensagens antigas: conteúdo novo não o arrasta
    await scrollChat(100);
    scrollToEnd.mockClear();
    await grow(1100);
    expect(scrollToEnd).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Mensagem'), 'Até amanhã');
    await user.press(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() => expect(scrollToEnd).toHaveBeenCalled());
    await waitFor(() => expect(mockMessages).toHaveBeenCalledTimes(2));
    // deixa a repetição do envio passar antes de contar a do crescimento
    await nextFrame();

    // a mensagem enviada chega e aumenta a conversa: ela vai até o fim, e
    // repete no quadro seguinte, quando o novo tamanho já está montado
    scrollToEnd.mockClear();
    await grow(1240);
    expect(scrollToEnd).toHaveBeenCalledTimes(2);
  });

  describe('past midnight', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(2026, 9, 12, 23, 59) });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('moves "Hoje" to the new day while the conversation stays open', async () => {
      mockMessages.mockResolvedValue([
        message(
          'm1',
          new Date(2026, 9, 12, 21, 14),
          'Lucas Ferreira',
          'Boa noite, turma.',
        ),
      ]);
      await renderChat();
      expect(
        await screen.findByRole('header', { name: 'Hoje' }),
      ).toBeOnTheScreen();
      // 00:00 do dia seguinte, com a conversa ainda montada
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      expect(screen.getByRole('header', { name: 'Ontem' })).toBeOnTheScreen();
      expect(
        screen.queryByRole('header', { name: 'Hoje' }),
      ).not.toBeOnTheScreen();
    });
  });

  it('pins the day label under the fixed header instead of cutting it', async () => {
    await renderChat();
    await threadLoaded();
    const days = screen.getAllByTestId('chat-day');
    expect(days).toHaveLength(2);
    await fireEvent.layout(days[0], { y: 0, height: 200 });
    await fireEvent.layout(days[1], { y: 208, height: 150 });
    // a etiqueta grudada repete o separador e fica fora da acessibilidade
    const sticky = () =>
      screen.queryByTestId('chat-sticky-day', { includeHiddenElements: true });
    const first = dayLabel(day(4, 21), new Date());
    const second = dayLabel(day(3, 8), new Date());

    await scrollChat(0);
    expect(sticky()).not.toBeOnTheScreen();
    await scrollChat(100);
    expect(sticky()).toHaveTextContent(first);
    // faixa opaca: o separador original e os balões passam por baixo dela
    expect(sticky()).toHaveStyle({
      backgroundColor: LIGHT.colors.background,
      left: 0,
      right: 0,
    });
    await scrollChat(230);
    expect(sticky()).toHaveTextContent(second);
  });

  it('shows the hint for an empty thread and the error with retry', async () => {
    mockMessages.mockResolvedValueOnce([]);
    await renderChat();
    expect(
      await screen.findByText(
        'Compartilhe informações da turma, como grupos, links, materiais e datas de prova.',
      ),
    ).toBeOnTheScreen();
    await screen.unmount();
    client.clear();

    mockMessages.mockReset().mockRejectedValueOnce(new Error('falhou'));
    await renderChat();
    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    });
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    mockMessages.mockResolvedValueOnce(THREAD);
    await userEvent.setup().press(retry);
    expect(await threadLoaded()).toBeOnTheScreen();
    expect(mockMessages).toHaveBeenCalledTimes(2);
  });
});

describe('subject list', () => {
  /** Linhas da lista: cada uma abre o mural da turma. */
  const rows = () => screen.getAllByHintText('Abre o mural da turma');

  it('lists each attended class once, without the canceled ones', async () => {
    const onSubjectPress = jest.fn();
    await renderList(onSubjectPress);
    expect(rows()).toHaveLength(2);
    // conversa ainda não aberta: a linha não tem o resumo das mensagens
    expect(rows()[0]).toHaveAccessibleName(
      'Sistemas Distribuídos IME02-10892 · Turma 2',
    );
    expect(rows()[1]).toHaveAccessibleName(
      'Compiladores IME02-10871 · Turma 1',
    );
    expect(screen.queryByText('Ética e Computação')).not.toBeOnTheScreen();
    expect(
      screen.getByText('Escolha a disciplina para abrir o mural da turma.'),
    ).toBeOnTheScreen();
    await userEvent.setup().press(rows()[1]);
    expect(onSubjectPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'IME02-10871', class: '1' }),
    );
    expect(mockMessages).not.toHaveBeenCalled();
  });

  it('summarizes threads already loaded in this session', async () => {
    client.setQueryData(
      communityKeys.messages(ACCOUNT.scope, {
        subjectId: SUBJECT.id,
        classNumber: '2',
        period: '2026.2',
      }),
      THREAD,
    );
    await renderList();
    expect(
      within(rows()[0]).getByText(/^3 mensagens · última em \d{2}\/\d/),
    ).toBeOnTheScreen();
    expect(mockMessages).not.toHaveBeenCalled();
  });

  it('follows the suggested period into a new semester while the list stays open', async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 30, 23, 59) });
    // sem o período do portal, vale a sugestão pelo calendário
    const portalPeriod = ACCOUNT.period;
    ACCOUNT.period = '';
    try {
      client.setQueryData(
        communityKeys.messages(ACCOUNT.scope, {
          subjectId: SUBJECT.id,
          classNumber: '2',
          period: '2026.2',
        }),
        THREAD,
      );
      await renderList();
      // 30 de junho: a sugestão é 2026.1, conversa ainda não aberta
      expect(
        within(rows()[0]).queryByText(/^3 mensagens/),
      ).not.toBeOnTheScreen();
      // 1º de julho: a sugestão passa a 2026.2, a mesma da conversa
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      expect(within(rows()[0]).getByText(/^3 mensagens/)).toBeOnTheScreen();
    } finally {
      ACCOUNT.period = portalPeriod;
      jest.useRealTimers();
    }
  });

  it('shows skeleton, empty and error states', async () => {
    mockSchedule = { ...mockSchedule, data: undefined, isLoading: true };
    await renderList();
    expect(screen.getByLabelText('Carregando disciplinas…')).toBeOnTheScreen();
    await screen.unmount();

    mockSchedule = { ...mockSchedule, data: [], isLoading: false };
    await renderList();
    expect(
      screen.getByText(
        'Parece que você não está inscrito em nenhuma disciplina no momento.',
      ),
    ).toBeOnTheScreen();
    await screen.unmount();

    mockSchedule = {
      ...mockSchedule,
      data: undefined,
      error: new Error('Portal fora do ar.'),
    };
    await renderList();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockSchedule.refetch).toHaveBeenCalled();
  });
});
