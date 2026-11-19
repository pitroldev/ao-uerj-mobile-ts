import React from 'react';
import { Linking } from 'react-native';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { Ideas, IDEAS_STATE_KEY } from '@root/modules/ideas/application/Ideas';
import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
import type { MyIdea } from '@root/modules/ideas/domain/ideas';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { MyIdeasPage } from '../MyIdeas';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockServices: { ideas: Ideas };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({ account: { scope: 'conta-1' } }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (effect: () => void | (() => void)) =>
      ReactModule.useEffect(effect, [effect]),
  };
});
const mockMoment = jest.fn();
jest.mock('@root/modules/delivery/presentation/positiveMoments', () => ({
  useDelayedMoment: () => mockMoment,
}));

const issue = (number: number) => ({
  number,
  url: `https://github.com/pitroldev/ao-uerj-mobile-ts/issues/${number}`,
});

const IDEAS: MyIdea[] = [
  {
    id: 'r1',
    kind: 'sent',
    title: 'Lembrete da PF no dia anterior',
    area: 'grades',
    createdAt: 3,
    status: 'received',
    issue: null,
    requests: 1,
  },
  {
    id: 'issue-31',
    kind: 'joined',
    title: 'Aviso de vaga nas turmas pedidas',
    area: null,
    createdAt: 2,
    status: 'planned',
    issue: issue(31),
    requests: 4,
  },
  {
    id: 'd1',
    kind: 'sent',
    title: 'Modo escuro no widget',
    area: 'home',
    createdAt: 1,
    status: 'done',
    issue: issue(21),
    requests: 6,
  },
];

let server: jest.Mocked<IdeasServerPort>;
let saved: Map<string, unknown>;

function services() {
  server = {
    mine: jest.fn(async () => ({ ideas: IDEAS, remainingToday: 2 })),
    similar: jest.fn(),
    submit: jest.fn(),
    vote: jest.fn(),
  };
  mockServices = {
    ideas: new Ideas({
      server,
      store: {
        read: async <T,>(scope: string, key: string) =>
          (saved.get(`${scope}/${key}`) as T) ?? null,
        write: async <T,>(scope: string, key: string, value: T) => {
          saved.set(`${scope}/${key}`, value);
        },
      },
      account: () => ({ scope: 'conta-1' }),
      app: { version: '2.20.0', platform: 'android' },
    }),
  };
}

const show = () =>
  renderWithProviders(<MyIdeasPage />, {
    queryClient: createTestQueryClient(),
  });

beforeEach(() => {
  saved = new Map();
  services();
  jest.mocked(Linking.openURL).mockReset().mockResolvedValue(undefined);
});

it('shows each idea with its state, and opens the ones on GitHub', async () => {
  await show();
  const received = await screen.findByLabelText(
    'Lembrete da PF no dia anterior. Recebida. Vai para o GitHub depois de uma olhada',
  );
  // ainda sem issue: nada para abrir
  expect(received).not.toHaveProp('accessibilityRole', 'link');
  const joined = screen.getByRole('link', {
    name: 'Aviso de vaga nas turmas pedidas. Pedido somado. Planejada. #31 · 4 pedidos',
  });
  await userEvent.setup().press(joined);
  expect(Linking.openURL).toHaveBeenCalledWith(issue(31).url);
});

it('highlights the idea that got done since the last visit, once, as a good moment', async () => {
  await show();
  expect(
    await screen.findByRole('link', {
      name: /^Novidade\. Modo escuro no widget/,
    }),
  ).toBeOnTheScreen();
  await waitFor(() =>
    expect(saved.get(`conta-1/${IDEAS_STATE_KEY}`)).toEqual({
      known: true,
      seenDone: ['d1'],
    }),
  );
  expect(mockMoment).toHaveBeenCalledTimes(1);

  // na próxima visita, a feita já foi vista
  await screen.unmount();
  services();
  await show();
  expect(
    await screen.findByRole('link', { name: /^Modo escuro no widget/ }),
  ).toBeOnTheScreen();
  expect(mockMoment).toHaveBeenCalledTimes(1);
});

it('invites the first idea when there is none', async () => {
  server.mine.mockResolvedValue({ ideas: [], remainingToday: 3 });
  await show();
  await userEvent
    .setup()
    .press(await screen.findByRole('button', { name: 'Sugerir uma ideia' }));
  expect(await screen.findByText('Passo 1 de 3')).toBeOnTheScreen();
});

it('waits for the student proof, and explains a ban', async () => {
  server.mine.mockRejectedValue(new AppError('STUDENT_PROOF_UNAVAILABLE'));
  await show();
  expect(
    await screen.findByText('Confirmando que você é aluno'),
  ).toBeOnTheScreen();

  // o banimento diz até quando, como no Agora no campus
  await screen.unmount();
  server.mine.mockRejectedValue(
    new AppError('STUDENT_BANNED', 'Sua conta está suspensa até 20/11.'),
  );
  await show();
  expect(
    await screen.findByText('Sua conta está suspensa até 20/11.'),
  ).toBeOnTheScreen();
});

it('goes back to Sobre', async () => {
  await show();
  await screen.findByLabelText(/^Lembrete da PF/);
  // a seta do cabeçalho e o voltar do Android levam ao Sobre
  const { headerStore } = jest.requireActual<
    typeof import('@templates/Header/headerStore')
  >('@templates/Header/headerStore');
  headerStore.getSnapshot().onBack?.();
  expect(mockNavigate).toHaveBeenCalledWith('Sobre');
});
