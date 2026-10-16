import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@root/test-utils/render';
import { DrawerNavigator } from '@root/components/templates/CustomDrawerNavigator';
import { AppUpdates } from '../../application/AppUpdates';
import { APP_STATUS_KEY, RemoteStatus } from '../../application/RemoteStatus';
import {
  createMemoryStore,
  createSource,
  createStoreListing,
} from '../../application/__tests__/fakes';
import { DeliveryProvider } from '../DeliveryProvider';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: 'signedIn',
    error: null,
    account: {
      scope: 's',
      name: 'Marina Albuquerque Teixeira',
      matricula: '202310045612',
      period: '2026.2',
    },
  }),
  useAppServices: () => ({
    identity: { signOut: jest.fn() },
    // o botão de tema do rodapé só lê a escolha
    appearance: mockAppearance,
  }),
}));
const mockAppearance = {
  subscribe: () => () => undefined,
  getSnapshot: () => 'system',
  choose: jest.fn(),
};

it('marks the screens disabled by the remote notice, which still explain themselves', async () => {
  const store = createMemoryStore({
    [APP_STATUS_KEY]: {
      schemaVersion: 1,
      minSupportedVersion: '1.0.0',
      notices: [],
      disabledFeatures: ['message-board', 'documents'],
    },
  });
  const now = () => 0;
  const delivery = {
    appVersion: '1.3.5',
    status: new RemoteStatus({
      source: createSource(new Error('offline')),
      store,
      now,
    }),
    updates: new AppUpdates({
      updates: null,
      storeListing: createStoreListing(false),
      store,
      now,
    }),
    review: { notePositiveMoment: jest.fn() },
  };
  const navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  const user = userEvent.setup();
  await renderWithProviders(
    <DeliveryProvider delivery={delivery} ready={false}>
      <DrawerNavigator
        {...({
          state: {
            routeNames: [
              'Início',
              'Mural de Mensagens',
              'Meu Progresso',
              'Emissão de Documentos',
            ],
            index: 0,
          },
          navigation,
        } as any)}
      />
    </DeliveryProvider>,
  );
  const board = await screen.findByRole('menuitem', {
    name: 'Mural de Mensagens, indisponível',
  });
  expect(board).toHaveTextContent(/Indisponível/);
  expect(
    screen.getByRole('menuitem', { name: 'Meu Progresso' }),
  ).not.toHaveTextContent(/Indisponível/);
  // continua navegável: a tela troca o conteúdo pela explicação
  await user.press(board);
  expect(navigation.navigate).toHaveBeenCalledWith('Mural de Mensagens');
  const documents = screen.getByRole('menuitem', {
    name: 'Emissão de Documentos, indisponível',
  });
  expect(documents).toHaveTextContent(/Indisponível/);
  await user.press(documents);
  expect(navigation.navigate).toHaveBeenCalledWith('Emissão de Documentos');
});
