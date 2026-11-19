import React from 'react';
import { Linking } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { Ideas, IDEAS_STATE_KEY } from '@root/modules/ideas/application/Ideas';
import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
import type { MyIdea } from '@root/modules/ideas/domain/ideas';
import {
  createTestQueryClient,
  renderWithProviders as renderWith,
} from '@root/test-utils/render';
import { AboutPage } from '../About';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@features/ErrorReport/ErrorReportModal', () => ({
  ErrorReportModal: 'ErrorReportModal',
}));
jest.mock('@features/Ideas/SuggestIdeaSheet', () => ({
  SuggestIdeaSheet: 'SuggestIdeaSheet',
}));
// sem a sessão de aluno (o simulador) até um teste ligar as sugestões
let mockServices: { ideas: Ideas };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({ account: { scope: 'conta-1' } }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const DONE: MyIdea = {
  id: 'd1',
  kind: 'sent',
  title: 'Modo escuro no widget',
  area: 'home',
  createdAt: 1,
  status: 'done',
  issue: { number: 21, url: 'https://github.com/o/r/issues/21' },
  requests: 6,
};
let mockServer: jest.Mocked<IdeasServerPort>;

function ideasService(supported: boolean, saved: Record<string, unknown>) {
  mockServer = {
    mine: jest.fn(async () => ({ ideas: [DONE], remainingToday: 3 })),
    similar: jest.fn(),
    submit: jest.fn(),
    vote: jest.fn(),
  };
  return new Ideas({
    server: supported ? mockServer : null,
    store: {
      read: async <T,>(scope: string, key: string) =>
        (saved[`${scope}/${key}`] as T) ?? null,
      write: async () => undefined,
    },
    account: () => ({ scope: 'conta-1' }),
    app: { version: '2.20.0', platform: 'android' },
  });
}

/** O Sobre com o cliente das consultas (as sugestões usam o React Query). */
const renderWithProviders = (ui: React.ReactElement) =>
  renderWith(ui, { queryClient: createTestQueryClient() });
// sem loja (os testes sem provedor) até um teste pôr a Play ou a App Store
let mockListing: { available: boolean; name: string; open: jest.Mock } | null =
  null;
// o JS da instalação até um teste pôr uma atualização OTA
let mockUpdate: { id: string; createdAt: Date } | null = null;
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  ...jest.requireActual('@root/modules/delivery/presentation/DeliveryProvider'),
  useStoreListing: () => mockListing,
  useRunningUpdate: () => mockUpdate,
}));

beforeEach(async () => {
  mockListing = null;
  mockUpdate = null;
  mockServices = { ideas: ideasService(false, {}) };
  jest.mocked(Linking.openURL).mockReset().mockResolvedValue(undefined);
  await renderWithProviders(<AboutPage />);
});

it('leaves rating and inviting out where the app is in no store', () => {
  expect(
    screen.queryByRole('header', { name: 'Ajude o app a crescer' }),
  ).toBeNull();
});

it('rates on the Play and invites the class where the app is in the store', async () => {
  mockListing = {
    available: true,
    name: 'Play Store',
    open: jest.fn(async () => undefined),
  };
  await renderWithProviders(<AboutPage />);
  const user = userEvent.setup();
  expect(
    screen.getByRole('header', { name: 'Ajude o app a crescer' }),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('link', { name: /^Avaliar na Play Store/ }),
  );
  expect(mockListing.open).toHaveBeenCalledTimes(1);
  await user.press(
    screen.getByRole('button', { name: /^Indicar para a turma/ }),
  );
  expect(await screen.findByText('Indicar o AO UERJ')).toBeOnTheScreen();
});

it('says so when the Play Store does not open', async () => {
  mockListing = {
    available: true,
    name: 'Play Store',
    open: jest.fn(async () => Promise.reject(new Error('sem loja'))),
  };
  await renderWithProviders(<AboutPage />);
  const showError = jest.spyOn(snackbar, 'error');
  await userEvent
    .setup()
    .press(screen.getByRole('link', { name: /^Avaliar na Play Store/ }));
  expect(showError).toHaveBeenCalledWith(
    'Não foi possível abrir a Play Store.',
  );
});

it('rates on the App Store on the iPhone', async () => {
  mockListing = {
    available: true,
    name: 'App Store',
    open: jest.fn(async () => Promise.reject(new Error('sem loja'))),
  };
  await renderWithProviders(<AboutPage />);
  const showError = jest.spyOn(snackbar, 'error');
  const rate = screen.getByRole('link', { name: /^Avaliar na App Store/ });
  expect(rate).toHaveProp(
    'accessibilityHint',
    'Abre a página do AO UERJ na App Store',
  );
  await userEvent.setup().press(rate);
  expect(mockListing.open).toHaveBeenCalledTimes(1);
  expect(showError).toHaveBeenCalledWith('Não foi possível abrir a App Store.');
});

it('shows the approved copy and the blog link', () => {
  expect(screen.getByRole('header', { name: 'AO UERJ' })).toBeOnTheScreen();
  expect(screen.getByText(/^Versão \d+\.\d+\.\d+$/)).toBeOnTheScreen();
  expect(
    screen.getByText(
      'App de código aberto, sem vínculo com a UERJ. Usa sua conta do Aluno Online.',
    ),
  ).toBeOnTheScreen();
  for (const section of ['Fala! Sou o Petro.', 'Ajude a melhorar']) {
    expect(screen.getByRole('header', { name: section })).toBeOnTheScreen();
  }
  expect(
    screen.getByText(
      'Criei o AO UERJ pra facilitar seu dia a dia na faculdade.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'pitrol.dev' })).toBeOnTheScreen();
});

it('shows the day of the OTA update next to the version only while one runs', async () => {
  expect(screen.queryByText(/atualização de/)).toBeNull();
  mockUpdate = { id: 'u-1', createdAt: new Date(2026, 10, 6, 21, 30) };
  await renderWithProviders(<AboutPage />);
  expect(
    screen.getByText(/^Versão \d+\.\d+\.\d+ · atualização de 06\/11$/),
  ).toBeOnTheScreen();
});

it('opens the report sheet from "Reportar problema"', async () => {
  // a folha simulada vira um elemento host: as props são o contrato com ela
  const sheet = () =>
    screen.container.queryAll(node => node.type === 'ErrorReportModal')[0];
  const user = userEvent.setup();
  expect(sheet()).toHaveProp('visible', false);
  await user.press(screen.getByRole('button', { name: /^Reportar problema/ }));
  expect(sheet()).toHaveProp('visible', true);
  await act(() => sheet().props.setVisibility(false));
  expect(sheet()).toHaveProp('visible', false);
});

it('opens the support, repository and developer links', async () => {
  const user = userEvent.setup();
  await user.press(screen.getByRole('link', { name: 'pitrol.dev' }));
  await user.press(screen.getByRole('link', { name: 'GitHub' }));
  await user.press(screen.getByRole('link', { name: /^Sugerir melhoria/ }));
  await user.press(screen.getByRole('link', { name: /^Ver código no GitHub/ }));
  await user.press(screen.getByRole('link', { name: 'LinkedIn' }));
  await user.press(screen.getByRole('link', { name: 'E-mail' }));
  await user.press(
    screen.getByRole('link', { name: /^Política de privacidade/ }),
  );
  expect(jest.mocked(Linking.openURL).mock.calls.map(c => c[0])).toEqual([
    'https://pitrol.dev/',
    'https://github.com/pitroldev',
    'https://github.com/pitroldev/ao-uerj-mobile-ts/issues',
    'https://github.com/pitroldev/ao-uerj-mobile-ts',
    'https://www.linkedin.com/in/petrocardoso/',
    'mailto:contato@pitrol.dev?subject=AO UERJ',
    // o endereço da Play Console
    'https://github.com/pitroldev/ao-uerj-mobile-ts/blob/main/docs/privacidade.md',
  ]);
});

it('puts the privacy policy under "Seus dados"', () => {
  // o arquivo em si é conferido em scripts/__tests__/privacy-policy.test.cjs
  expect(screen.getByRole('header', { name: 'Seus dados' })).toBeOnTheScreen();
  expect(
    screen.getByRole('link', { name: /^Política de privacidade/ }),
  ).toBeOnTheScreen();
});

describe('suggestions', () => {
  // a folha simulada vira um elemento host: as props são o contrato com ela
  const sheet = () =>
    screen.container.queryAll(node => node.type === 'SuggestIdeaSheet')[0];

  it('opens the suggestion sheet and Minhas sugestões where the app signs in as a student', async () => {
    mockServices = { ideas: ideasService(true, {}) };
    await renderWithProviders(<AboutPage />);
    const user = userEvent.setup();
    // no lugar do link para o GitHub
    expect(
      screen.queryByRole('link', { name: /^Sugerir melhoria/ }),
    ).toBeNull();
    expect(sheet()).toHaveProp('visible', false);
    await user.press(
      screen.getByRole('button', { name: /^Sugerir uma ideia/ }),
    );
    expect(sheet()).toHaveProp('visible', true);
    // a confirmação do envio leva a Minhas sugestões e fecha a folha
    await act(() => sheet().props.onShowMine());
    expect(mockNavigate).toHaveBeenCalledWith('Minhas sugestões');
    expect(sheet()).toHaveProp('visible', false);
    await user.press(screen.getByRole('button', { name: /^Minhas sugestões/ }));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    // quem nunca sugeriu não passa pela confirmação de aluno ao abrir o Sobre
    expect(mockServer.mine).not.toHaveBeenCalled();
  });

  it('counts the ideas done since the last look, for whoever has suggested', async () => {
    mockServices = {
      ideas: ideasService(true, {
        [`conta-1/${IDEAS_STATE_KEY}`]: { known: true, seenDone: [] },
      }),
    };
    await renderWithProviders(<AboutPage />);
    expect(
      await screen.findByRole('button', { name: 'Minhas sugestões, 1 feita' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('1 feita')).toBeOnTheScreen();
  });
});

it.each(['pitrol.dev', 'GitHub', 'LinkedIn', 'E-mail'])(
  'tells the student when %s cannot be opened',
  async label => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const showError = jest.spyOn(snackbar, 'error');
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('sem app'));
    await userEvent.setup().press(screen.getByRole('link', { name: label }));
    expect(showError).toHaveBeenCalledWith('Não foi possível abrir este link.');
    log.mockRestore();
  },
);
