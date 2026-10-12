import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
} from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

import { LIGHT } from '@root/themes';
import type { Message } from '@root/modules/community/domain/models';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import { ListRow, SkeletonList } from '@components/ui';
import SubjectChat from '../SubjectChat';
import SubjectList from '../SubjectList';
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
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
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
let renderer: ReactTestRenderer;
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
  });
const render = async (node: React.ReactElement) => {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <ThemeProvider theme={LIGHT}>{node}</ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await settle();
};
const flatten = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(flatten).join('')
    : typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : '';
const texts = (root = renderer.root) =>
  root.findAllByType(RNText).map(t => flatten(t.props.children));
const byLabel = (label: string) =>
  renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];

beforeEach(() => {
  onlineManager.setOnline(true);
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
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
afterEach(async () => {
  await act(async () => renderer?.unmount());
  client.clear();
});

describe('subject chat', () => {
  it('shows the class header, day separators and own messages as "Você"', async () => {
    await render(<SubjectChat {...SUBJECT} />);
    expect(mockMessages).toHaveBeenCalledWith(
      { subjectId: SUBJECT.id, classNumber: '2', period: '2026.2' },
      expect.anything(),
    );
    const all = texts();
    expect(all).toContain('Sistemas Distribuídos');
    expect(all).toContain('IME02-10892 · Turma 2');
    expect(all).toContain('Período das mensagens');
    expect(all).toContain(dayLabel(day(4, 21), new Date()));
    expect(all).toContain(dayLabel(day(3, 8), new Date()));
    expect(all).toContain('Você');
    expect(all).toContain('Lucas Ferreira');
    expect(all).toContain('21:14');
    expect(
      byLabel('Mensagem de você, 08:15. Alguém tem os slides?'),
    ).toBeDefined();
  });

  it('copies a message when it is tapped', async () => {
    await render(<SubjectChat {...SUBJECT} />);
    await act(async () =>
      byLabel(
        'Mensagem de Beatriz Nunes, 08:02. P2 confirmada para 24/11.',
      ).props.onPress(),
    );
    expect(Clipboard.setString).toHaveBeenCalledWith(
      'P2 confirmada para 24/11.',
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Copiado com sucesso!' }),
    );
  });

  it('sends the typed message and clears the composer', async () => {
    await render(<SubjectChat {...SUBJECT} />);
    const send = () => byLabel('Enviar mensagem');
    expect(send().props.disabled).toBe(true);
    const input = renderer.root.findByProps({
      accessibilityLabel: 'Mensagem',
    }) as unknown as { props: { onChangeText: (t: string) => void } };
    await act(async () => input.props.onChangeText('  Até amanhã  '));
    expect(send().props.disabled).toBe(false);
    await act(async () => send().props.onPress());
    await settle();
    expect(mockPost).toHaveBeenCalledWith(
      { subjectId: SUBJECT.id, classNumber: '2', period: '2026.2' },
      '  Até amanhã  ',
    );
    expect(mockMessages).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType(TextInput).props.value).toBe('');
  });

  it('follows the conversation to the sent message, even after scrolling up', async () => {
    await render(<SubjectChat {...SUBJECT} />);
    const [scroll] = renderer.root
      .findAllByType(ScrollView)
      .filter(node => typeof node.props.onScroll === 'function');
    const scrollToEnd = (scroll.instance as { scrollToEnd: jest.Mock })
      .scrollToEnd;
    const grow = async (height: number) => {
      await act(async () => scroll.props.onContentSizeChange(412, height));
      await settle();
    };

    // o aluno sobe para ler mensagens antigas: conteúdo novo não o arrasta
    await act(async () =>
      scroll.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 400 },
        },
      }),
    );
    scrollToEnd.mockClear();
    await grow(1100);
    expect(scrollToEnd).not.toHaveBeenCalled();

    const input = renderer.root.findByProps({
      accessibilityLabel: 'Mensagem',
    }) as unknown as { props: { onChangeText: (t: string) => void } };
    await act(async () => input.props.onChangeText('Até amanhã'));
    await act(async () => byLabel('Enviar mensagem').props.onPress());
    await settle();
    expect(scrollToEnd).toHaveBeenCalled();

    // a mensagem enviada chega e aumenta a conversa: ela vai até o fim, e
    // repete no quadro seguinte, quando o novo tamanho já está montado
    scrollToEnd.mockClear();
    await grow(1240);
    expect(scrollToEnd).toHaveBeenCalledTimes(2);
  });

  it('pins the day label under the fixed header instead of cutting it', async () => {
    await render(<SubjectChat {...SUBJECT} />);
    const days = renderer.root
      .findAllByProps({ testID: 'chat-day' })
      .filter(n => typeof n.type === 'string');
    expect(days).toHaveLength(2);
    const [scroll] = renderer.root
      .findAllByType(ScrollView)
      .filter(node => typeof node.props.onScroll === 'function');
    const scrollTo = async (y: number) =>
      act(async () =>
        scroll.props.onScroll({
          nativeEvent: {
            contentOffset: { y },
            contentSize: { height: 1000 },
            layoutMeasurement: { height: 400 },
          },
        }),
      );
    await act(async () => {
      days[0].props.onLayout({
        nativeEvent: { layout: { y: 0, height: 200 } },
      });
      days[1].props.onLayout({
        nativeEvent: { layout: { y: 208, height: 150 } },
      });
    });
    const sticky = () =>
      renderer.root
        .findAllByProps({ testID: 'chat-sticky-day' })
        .map(node => texts(node).join(''))[0];
    const first = dayLabel(day(4, 21), new Date());
    const second = dayLabel(day(3, 8), new Date());

    await scrollTo(0);
    expect(sticky()).toBeUndefined();
    await scrollTo(100);
    expect(sticky()).toBe(first);
    // faixa opaca: o separador original e os balões passam por baixo dela
    const slot = renderer.root
      .findAllByProps({ testID: 'chat-sticky-day' })
      .find(node => typeof node.type === 'string')!;
    expect(StyleSheet.flatten(slot.props.style)).toMatchObject({
      backgroundColor: LIGHT.colors.surface,
      left: 0,
      right: 0,
    });
    await scrollTo(230);
    expect(sticky()).toBe(second);
  });

  it('shows the hint for an empty thread and the error with retry', async () => {
    mockMessages.mockResolvedValueOnce([]);
    await render(<SubjectChat {...SUBJECT} />);
    expect(texts()).toContain(
      'Compartilhe informações da turma, como grupos, links, materiais e datas de prova.',
    );
    await act(async () => renderer.unmount());
    client.clear();

    mockMessages.mockReset().mockRejectedValueOnce(new Error('falhou'));
    await render(<SubjectChat {...SUBJECT} />);
    const retry = renderer.root.findAll(
      n =>
        n.props.label === 'Tentar novamente' &&
        typeof n.props.onPress === 'function',
    )[0];
    expect(retry).toBeDefined();
    mockMessages.mockResolvedValueOnce(THREAD);
    await act(async () => retry!.props.onPress());
    await settle();
    expect(mockMessages).toHaveBeenCalledTimes(2);
    expect(texts()).toContain('Lucas Ferreira');
  });
});

describe('subject list', () => {
  it('lists each attended class once, without the canceled ones', async () => {
    const onSubjectPress = jest.fn();
    await render(<SubjectList onSubjectPress={onSubjectPress} />);
    const rows = renderer.root.findAllByType(ListRow);
    expect(rows.map(row => row.props.title)).toEqual([
      'Sistemas Distribuídos',
      'Compiladores',
    ]);
    expect(rows[0].props.subtitle).toBe('Turma 2');
    expect(rows[0].props.meta).toBeUndefined();
    expect(texts()).toContain(
      'Escolha a disciplina para abrir o mural da turma.',
    );
    await act(async () => rows[1].props.onPress());
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
    await render(<SubjectList onSubjectPress={jest.fn()} />);
    const [first] = renderer.root.findAllByType(ListRow);
    expect(first.props.meta).toMatch(/^3 mensagens · última em \d{2}\/\d/);
    expect(mockMessages).not.toHaveBeenCalled();
  });

  it('shows skeleton, empty and error states', async () => {
    mockSchedule = { ...mockSchedule, data: undefined, isLoading: true };
    await render(<SubjectList onSubjectPress={jest.fn()} />);
    expect(renderer.root.findAllByType(SkeletonList)).toHaveLength(1);
    await act(async () => renderer.unmount());

    mockSchedule = { ...mockSchedule, data: [], isLoading: false };
    await render(<SubjectList onSubjectPress={jest.fn()} />);
    expect(texts()).toContain(
      'Parece que você não está inscrito em nenhuma disciplina no momento.',
    );
    await act(async () => renderer.unmount());

    mockSchedule = {
      ...mockSchedule,
      data: undefined,
      error: new Error('Portal fora do ar.'),
    };
    await render(<SubjectList onSubjectPress={jest.fn()} />);
    const retry = renderer.root.findAll(
      n =>
        n.props.label === 'Tentar novamente' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => retry!.props.onPress());
    expect(mockSchedule.refetch).toHaveBeenCalled();
  });
});
