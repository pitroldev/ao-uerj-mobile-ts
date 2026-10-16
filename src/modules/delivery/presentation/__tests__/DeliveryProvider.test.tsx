import React from 'react';
import { AppState, Linking, Text } from 'react-native';
import {
  act,
  renderHook,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { createWrapper, renderWithProviders } from '@root/test-utils/render';
import { AppUpdates } from '../../application/AppUpdates';
import {
  APP_STATUS_KEY,
  DISMISSED_NOTICES_KEY,
  RemoteStatus,
} from '../../application/RemoteStatus';
import {
  appUpdate,
  createMemoryStore,
  createSource,
  createStoreListing,
  createUpdatesPort,
} from '../../application/__tests__/fakes';
import {
  DeliveryProvider,
  usePositiveMoment,
  type Delivery,
} from '../DeliveryProvider';
import { FeatureGate, UNAVAILABLE_TEXT } from '../FeatureGate';
import { RemoteNotices } from '../RemoteNotices';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const doc = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  minSupportedVersion: '1.0.0',
  notices: [],
  disabledFeatures: [],
  ...overrides,
});

function createDelivery({
  saved,
  fetched = new Error('offline'),
  port = createUpdatesPort(null),
  storeListing = createStoreListing(),
}: {
  saved?: unknown;
  fetched?: unknown;
  port?: ReturnType<typeof createUpdatesPort> | null;
  storeListing?: ReturnType<typeof createStoreListing>;
} = {}) {
  const store = createMemoryStore(saved ? { [APP_STATUS_KEY]: saved } : {});
  const now = () => Date.parse('2026-10-12T12:00:00Z');
  const review = { notePositiveMoment: jest.fn(async () => true) };
  const delivery: Delivery = {
    appVersion: '1.3.5',
    status: new RemoteStatus({ source: createSource(fetched), store, now }),
    updates: new AppUpdates({ updates: port, storeListing, store, now }),
    review,
  };
  return { delivery, store, port, storeListing, review };
}

const mount = (
  delivery: Delivery,
  children: React.ReactNode = <Text>Conteúdo do app</Text>,
  ready = true,
) =>
  renderWithProviders(
    <DeliveryProvider delivery={delivery} ready={ready}>
      {children}
    </DeliveryProvider>,
  );

/** O app volta ao primeiro plano (todos os ouvintes de AppState). */
const foreground = () =>
  act(() => {
    for (const [type, handler] of jest.mocked(AppState.addEventListener).mock
      .calls)
      if (type === 'change') handler('active');
  });

describe('unsupported version', () => {
  it('covers the app with the update screen and opens the immediate update', async () => {
    const user = userEvent.setup();
    const { delivery, port } = createDelivery({
      saved: doc({ minSupportedVersion: '1.4.0' }),
      port: createUpdatesPort(),
    });
    await mount(delivery, undefined, false);
    expect(
      await screen.findByRole('header', { name: 'Atualize o app' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/^A versão 1\.3\.5 não funciona mais/),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Atualizar' }));
    expect(port!.start).toHaveBeenCalledWith('immediate');
  });

  it('starts the immediate update by itself once navigation is ready', async () => {
    const { delivery, port } = createDelivery({
      fetched: doc({ minSupportedVersion: '2.0.0' }),
      port: createUpdatesPort(),
    });
    await mount(delivery);
    await screen.findByRole('header', { name: 'Atualize o app' });
    await waitFor(() => expect(port!.start).toHaveBeenCalledWith('immediate'));
  });

  it('lifts the block when the store has nothing newer for this device', async () => {
    // rollout parcial, versão ainda não promovida ou mínima errada no aviso
    const { delivery, port } = createDelivery({
      saved: doc({ minSupportedVersion: '1.4.0' }),
      port: createUpdatesPort(appUpdate({ availability: 'none' })),
    });
    await mount(delivery);
    await waitFor(() =>
      expect(
        screen.queryByRole('header', { name: 'Atualize o app' }),
      ).not.toBeOnTheScreen(),
    );
    expect(port!.check).toHaveBeenCalled();
    expect(port!.start).not.toHaveBeenCalled();
    expect(screen.getByText('Conteúdo do app')).toBeOnTheScreen();
  });

  it('has no button where there is no store to open', async () => {
    const { delivery } = createDelivery({
      saved: doc({ minSupportedVersion: '1.4.0' }),
      port: null,
      storeListing: createStoreListing(false),
    });
    await mount(delivery);
    await screen.findByRole('header', { name: 'Atualize o app' });
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
    ).not.toBeOnTheScreen();
  });

  it('leaves a supported version alone', async () => {
    const { delivery } = createDelivery({ saved: doc() });
    await mount(delivery);
    await waitFor(() =>
      expect(delivery.status.getSnapshot().status).not.toBeNull(),
    );
    expect(screen.getByText('Conteúdo do app')).toBeOnTheScreen();
    expect(
      screen.queryByRole('header', { name: 'Atualize o app' }),
    ).not.toBeOnTheScreen();
  });
});

describe('store updates', () => {
  it('checks only after navigation is ready, and again on returning to the foreground', async () => {
    const { delivery, port } = createDelivery({ port: createUpdatesPort() });
    await mount(delivery, undefined, false);
    expect(port!.check).not.toHaveBeenCalled();
    await screen.rerender(
      <DeliveryProvider delivery={delivery} ready>
        <Text>Conteúdo do app</Text>
      </DeliveryProvider>,
    );
    await waitFor(() => expect(port!.check).toHaveBeenCalledTimes(1));
    expect(port!.start).toHaveBeenCalledWith('flexible');
    await foreground();
    await waitFor(() => expect(port!.check).toHaveBeenCalledTimes(2));
    expect(port!.start).toHaveBeenCalledTimes(1);
  });

  it('waits for the app to be in front before checking (the store screen may be on top)', async () => {
    const { delivery, port } = createDelivery({
      saved: doc({ minSupportedVersion: '1.4.0' }),
      port: createUpdatesPort(),
    });
    const state = AppState as { currentState: unknown };
    const original = state.currentState;
    state.currentState = 'background';
    try {
      await mount(delivery);
      // a busca do aviso termina com o app em segundo plano
      await act(() => delivery.status.start());
      expect(port!.check).not.toHaveBeenCalled();
      await foreground();
      await waitFor(() =>
        expect(port!.start).toHaveBeenCalledWith('immediate'),
      );
      expect(port!.check).toHaveBeenCalledTimes(1);
    } finally {
      state.currentState = original;
    }
  });

  it('announces the finished download and offers to restart at the top of Início', async () => {
    const user = userEvent.setup();
    const success = jest
      .spyOn(snackbar, 'success')
      .mockImplementation(() => undefined);
    const { delivery, port } = createDelivery({ port: createUpdatesPort() });
    await mount(delivery, <RemoteNotices />);
    await act(() =>
      port!.emit({ status: 'downloading', bytesDownloaded: 1, totalBytes: 2 }),
    );
    expect(success).not.toHaveBeenCalled();
    await act(() =>
      port!.emit({ status: 'downloaded', bytesDownloaded: 2, totalBytes: 2 }),
    );
    expect(success).toHaveBeenCalledWith(
      'Nova versão baixada',
      'Toque em “Reiniciar” no Início para instalar.',
    );
    expect(
      screen.getByText('Nova versão baixada. Reinicie o app para instalar.'),
    ).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', {
        name: 'Reiniciar e instalar a nova versão',
      }),
    );
    expect(port!.complete).toHaveBeenCalled();
  });

  it('warns when the store cannot install the download, and drops a download that is gone', async () => {
    const user = userEvent.setup();
    jest.spyOn(snackbar, 'success').mockImplementation(() => undefined);
    const error = jest
      .spyOn(snackbar, 'error')
      .mockImplementation(() => undefined);
    const { delivery, port } = createDelivery({ port: createUpdatesPort() });
    port!.complete.mockRejectedValueOnce(
      new Error('ERROR_INSTALL_NOT_ALLOWED'),
    );
    await mount(delivery, <RemoteNotices />, false);
    await act(() =>
      port!.emit({ status: 'downloaded', bytesDownloaded: 2, totalBytes: 2 }),
    );
    await user.press(
      screen.getByRole('button', {
        name: 'Reiniciar e instalar a nova versão',
      }),
    );
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Não foi possível instalar a atualização agora.',
      ),
    );
    expect(
      screen.queryByText('Nova versão baixada. Reinicie o app para instalar.'),
    ).not.toBeOnTheScreen();
  });
});

describe('remote notices', () => {
  const notices = [
    {
      id: 'notas',
      level: 'warning',
      title: 'Notas fora do ar',
      message: 'O Aluno Online mudou a página de notas.',
      url: 'https://github.com/pitroldev/ao-uerj-mobile-ts/issues/1',
    },
    {
      id: 'boas-vindas',
      level: 'info',
      title: 'Bem-vindo ao período',
      message: 'Confira a grade nova.',
    },
  ];

  it('shows the notices, opens the link and dismisses them for good', async () => {
    const user = userEvent.setup();
    const { delivery, store } = createDelivery({
      fetched: doc({ notices }),
    });
    await mount(delivery, <RemoteNotices />);
    expect(
      await screen.findByRole('alert', { name: 'Notas fora do ar' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('O Aluno Online mudou a página de notas.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Bem-vindo ao período' }),
    ).toBeOnTheScreen();

    // o domínio aparece antes de abrir
    expect(screen.getByText('Saiba mais em github.com')).toBeOnTheScreen();
    await user.press(
      screen.getByRole('link', {
        name: 'Saiba mais em github.com: Notas fora do ar',
      }),
    );
    expect(Linking.openURL).toHaveBeenCalledWith(notices[0].url);

    await user.press(
      screen.getByRole('button', { name: 'Dispensar aviso: Notas fora do ar' }),
    );
    expect(screen.queryByText('Notas fora do ar')).not.toBeOnTheScreen();
    expect(screen.getByText('Bem-vindo ao período')).toBeOnTheScreen();
    await waitFor(() =>
      expect(store.data.get(DISMISSED_NOTICES_KEY)).toEqual(['notas']),
    );
  });

  it('drops a notice that asks for the password or links outside the list', async () => {
    const { delivery } = createDelivery({
      fetched: doc({
        notices: [
          {
            id: 'sessao',
            level: 'critical',
            title: 'Sessão do Aluno Online expirada',
            message: 'Confirme matrícula e senha para continuar.',
          },
          {
            id: 'login',
            level: 'critical',
            title: 'Entre de novo',
            message: 'O acesso mudou.',
            url: 'https://alunoonline-uerj.com.br/login',
          },
          notices[1],
        ],
      }),
    });
    await mount(delivery, <RemoteNotices />);
    expect(
      await screen.findByRole('header', { name: 'Bem-vindo ao período' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(screen.queryByRole('link')).not.toBeOnTheScreen();
  });

  it('renders nothing without the provider', async () => {
    await renderWithProviders(<RemoteNotices />);
    expect(screen.toJSON()).toBeNull();
  });
});

describe('disabled features', () => {
  it('does not mount document queries when document issuance is disabled', async () => {
    const { delivery } = createDelivery({
      saved: doc({ disabledFeatures: ['documents'] }),
    });
    await delivery.status.start();
    const mounted = jest.fn();
    function DocumentsProbe() {
      mounted();
      return <Text>Catálogo de documentos</Text>;
    }
    await mount(
      delivery,
      <FeatureGate routeName="Emissão de Documentos">
        <DocumentsProbe />
      </FeatureGate>,
      false,
    );
    expect(
      await screen.findByRole('header', { name: 'Indisponível no momento' }),
    ).toBeOnTheScreen();
    expect(mounted).not.toHaveBeenCalled();
  });
  it('replaces a disabled screen with an explanation', async () => {
    const { delivery } = createDelivery({
      saved: doc({ disabledFeatures: ['message-board'] }),
    });
    await mount(
      delivery,
      <>
        <FeatureGate routeName="Mural de Mensagens">
          <Text>Conversas</Text>
        </FeatureGate>
        <FeatureGate routeName="Meu Progresso">
          <Text>Progresso</Text>
        </FeatureGate>
      </>,
    );
    expect(
      await screen.findByRole('header', { name: 'Indisponível no momento' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(UNAVAILABLE_TEXT)).toBeOnTheScreen();
    expect(screen.queryByText('Conversas')).not.toBeOnTheScreen();
    expect(screen.getByText('Progresso')).toBeOnTheScreen();
  });

  it('shows every screen without the provider', async () => {
    await renderWithProviders(
      <FeatureGate routeName="Mural de Mensagens">
        <Text>Conversas</Text>
      </FeatureGate>,
    );
    expect(screen.getByText('Conversas')).toBeOnTheScreen();
  });
});

describe('usePositiveMoment', () => {
  it('reports the moment to the review prompter', async () => {
    const { delivery, review } = createDelivery();
    const { result } = await renderHook(() => usePositiveMoment(), {
      wrapper: createWrapper({
        wrapper: ({ children }) => (
          <DeliveryProvider delivery={delivery} ready={false}>
            {children}
          </DeliveryProvider>
        ),
      }),
    });
    await act(() => result.current());
    expect(review.notePositiveMoment).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the provider', async () => {
    const { result } = await renderHook(() => usePositiveMoment());
    expect(() => result.current()).not.toThrow();
  });
});
