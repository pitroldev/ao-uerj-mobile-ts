import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@root/test-utils/render';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMapPage, MapScreen } from '../CampusMap';

const mockService = new CampusMap(bundledCampusMap);
const mockRoute: { params: { location?: string } } = { params: {} };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ campusMap: mockService }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useRoute: () => mockRoute,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it('opens a classroom in the campus context with a clean search field', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019 B" />);
  expect(screen.getByText('Sala 6019 B')).toBeVisible();
  expect(screen.getByText('6º andar · Bloco B')).toBeVisible();
  expect(screen.getByLabelText('Buscar sala ou lugar')).toHaveProp('value', '');
  expect(screen.getByRole('tab', { name: 'Campus' })).toBeSelected();
  expect(screen.queryByLabelText('Escolher andar')).toBeNull();
  expect(screen.getByRole('button', { name: 'Como chegar' })).toBeVisible();
  expect(screen.getByLabelText('Ampliar mapa')).toBeVisible();
});

it('asks for a missing block instead of silently selecting one', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019" />);
  expect(screen.getByText('6º andar · Escolha o bloco')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher bloco' }));
  await fireEvent.press(screen.getByLabelText('Selecionar Bloco B'));
  expect(screen.getByText('Sala 6019 B')).toBeVisible();
});

it('keeps the selected classroom when switching between campus and floor', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019" />);
  expect(screen.getByLabelText('Buscar sala ou lugar')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher bloco' }));
  await fireEvent.press(screen.getByLabelText('Selecionar Bloco B'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Andar' }));
  expect(screen.getByText('Sala 6019 B')).toBeVisible();
  expect(screen.getByText('6º andar · Bloco B')).toBeVisible();
  expect(screen.getByLabelText('Escolher andar')).toBeVisible();
  expect(screen.queryByLabelText('Buscar sala ou lugar')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Escolher bloco'));
  await fireEvent.press(screen.getByLabelText('Selecionar Bloco B'));
  expect(screen.getByText('Sala 6019 B')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Andar' })).toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Campus' }));
  expect(screen.queryByLabelText('Escolher andar')).toBeNull();
  expect(screen.getByLabelText('Buscar sala ou lugar')).toBeVisible();
});

it('groups nearby blocks without losing a pending classroom selection', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019" />);
  await fireEvent(screen.getByTestId('campus-map-plot'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 180 } },
  });
  const pavilion = screen.getByLabelText('No mapa: Pavilhão João Lyra Filho');
  await fireEvent.press(pavilion);
  expect(screen.getByText('6º andar · Escolha o bloco')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher bloco' }));
  await fireEvent.press(screen.getByLabelText('Selecionar Bloco B'));
  expect(screen.getByText('Sala 6019 B')).toBeVisible();
});

it('keeps both entrances and stations available on a compact campus map', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019 B" />);
  await fireEvent(screen.getByTestId('campus-map-plot'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 244 } },
  });
  for (const name of [
    'Portão 1',
    'Portão 5',
    'Metrô Maracanã',
    'Estação Maracanã · trens',
  ]) {
    expect(screen.getByLabelText(`No mapa: ${name}`)).toBeVisible();
  }
});

it('finds a library and preserves its name at the destination', async () => {
  await renderWithProviders(<MapScreen />);
  await fireEvent.changeText(
    screen.getByLabelText('Buscar sala ou lugar'),
    'CTC/A',
  );
  await fireEvent.press(screen.getByText('Biblioteca CTC/A'));
  expect(screen.getByText('Biblioteca CTC/A')).toBeVisible();
  expect(screen.getByText('6º andar · Bloco C · Sala 6002')).toBeVisible();
  expect(screen.getByLabelText('Buscar sala ou lugar')).toHaveProp('value', '');
});

it('honors new route parameters after exploring a library floor', async () => {
  mockRoute.params = { location: '6019 B' };
  const view = await renderWithProviders(<CampusMapPage />);
  await fireEvent.changeText(
    screen.getByLabelText('Buscar sala ou lugar'),
    'CTC/A',
  );
  await fireEvent.press(screen.getByText('Biblioteca CTC/A'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Andar' }));
  expect(screen.getByText('6º andar · Bloco C · Sala 6002')).toBeVisible();

  mockRoute.params = { location: '9023 D' };
  await view.rerender(<CampusMapPage />);
  expect(screen.getByText('Sala 9023 D')).toBeVisible();
  expect(screen.getByText('9º andar · Bloco D')).toBeVisible();
  expect(screen.queryByText('Biblioteca CTC/A')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Campus' })).toBeSelected();
  mockRoute.params = {};
});

it('changing floors clears the previous room highlight', async () => {
  await renderWithProviders(<MapScreen initialLocation="9023 D" />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Andar' }));
  await fireEvent.press(screen.getByLabelText('Escolher andar'));
  await fireEvent.press(screen.getByText('8º andar'));
  expect(screen.queryByText('Sala 9023 D')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Andar' })).toBeSelected();
});

it('shows walking instructions from either entrance and opens the destination floor', async () => {
  await renderWithProviders(<MapScreen initialLocation="6019 B" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Como chegar' }));
  expect(
    screen.getByText('Entre pelo Portão 1, na Av. Rei Pelé.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Passo 3')).toBeVisible();
  await fireEvent.press(screen.getByRole('tab', { name: 'Portão 5' }));
  expect(
    screen.getByText('Entre pelo Portão 5, na São Francisco Xavier, 524.'),
  ).toBeVisible();
  expect(
    screen.queryByText('Entre pelo Portão 1, na Av. Rei Pelé.'),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Ver andar' }));
  expect(screen.getByRole('tab', { name: 'Andar' })).toBeSelected();
  await waitFor(() =>
    expect(screen.getAllByText('Sala 6019 B')).toHaveLength(1),
  );
  expect(screen.getByRole('button', { name: 'Como chegar' })).toBeVisible();
});

it('clears a selected destination and returns to the campus', async () => {
  await renderWithProviders(<MapScreen initialLocation="9023 D" />);
  await fireEvent.press(screen.getByLabelText('Ver campus inteiro'));
  expect(screen.getByText('Campus Maracanã')).toBeVisible();
});

it.each(['light', 'dark'] as const)(
  'handles virtual and missing locations in %s',
  async theme => {
    await renderWithProviders(<MapScreen initialLocation="AVA" />, { theme });
    expect(
      screen.getByText('Aula virtual · não há local físico.'),
    ).toBeVisible();
    await fireEvent.changeText(
      screen.getByLabelText('Buscar sala ou lugar'),
      'Não informado',
    );
    expect(
      screen.getByText('O local da aula não foi informado.'),
    ).toBeVisible();
  },
);

describe('a class with more than one place', () => {
  // como o portal escreve na grade em curso (17/11/2026)
  const circuits =
    'Sala 5.098/F         (Pav. João Lira Filho) / LEE 09               (Pav. João Lira Filho)';

  it('opens the first place and switches to the others', async () => {
    await renderWithProviders(<MapScreen initialLocation={circuits} />);
    expect(screen.getByRole('header', { name: 'Sala 5098 F' })).toBeVisible();
    expect(screen.getByText('5º andar · Bloco F')).toBeVisible();
    expect(screen.getByLabelText('Buscar sala ou lugar')).toHaveProp(
      'value',
      '',
    );
    expect(
      screen.getByRole('togglebutton', { name: 'Sala 5098 F' }),
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true }),
    );

    await fireEvent.press(screen.getByRole('togglebutton', { name: 'LEE 09' }));
    // cada LEE é uma sala: a posição sai da ordem dos laboratórios
    expect(screen.getByRole('header', { name: 'LEE 09' })).toBeVisible();
    expect(screen.getByText('5º andar · Bloco F')).toBeVisible();
    expect(
      screen.getByText('Pela ordem dos LEE (o 1 é a 5116) · confira a porta.'),
    ).toBeVisible();

    // na vista do andar, a troca mantém a vista
    await fireEvent.press(screen.getByRole('tab', { name: 'Andar' }));
    await fireEvent.press(
      screen.getByRole('togglebutton', { name: 'Sala 5098 F' }),
    );
    expect(screen.getByRole('tab', { name: 'Andar' })).toBeSelected();
    expect(screen.getByRole('header', { name: 'Sala 5098 F' })).toBeVisible();
  });

  it('finds a lab typed in the search', async () => {
    await renderWithProviders(<MapScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Buscar sala ou lugar'),
      'LEE 13',
    );
    expect(
      screen.getByText(
        'Laboratórios de Engenharia Elétrica (LEE) · 5º andar · Bloco F · Sala 5116',
      ),
    ).toBeVisible();
    await fireEvent.press(screen.getByTestId('room-result'));
    expect(screen.getByRole('header', { name: 'LEE 13' })).toBeVisible();
  });
});

describe('a class place without the exact room', () => {
  it('takes a Law room to the 7th floor and asks to check the signs', async () => {
    await renderWithProviders(
      <MapScreen initialLocation="DIR01 (Pav. João Lira Filho) / DIR02 (Pav. João Lira Filho)" />,
    );
    expect(screen.getByRole('header', { name: 'DIR01' })).toBeVisible();
    expect(screen.getByText('7º andar · Bloco F')).toBeVisible();
    expect(
      screen.getByText('A sala exata não vem no portal: confira no andar.'),
    ).toBeVisible();
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'DIR02' }));
    expect(screen.getByRole('header', { name: 'DIR02' })).toBeVisible();
  });

  it('opens a place outside the pavilion by its name', async () => {
    await renderWithProviders(
      <MapScreen initialLocation="COART 3 (Prédio não definido)" />,
    );
    expect(
      screen.getByRole('header', { name: 'Coordenadoria de Artes (COART)' }),
    ).toBeVisible();
    expect(screen.getByText('2º andar · Centro Cultural')).toBeVisible();
  });
});

describe('bus stops (issue #26)', () => {
  it('shows the lines of a stop and where each one goes', async () => {
    await renderWithProviders(<MapScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Buscar sala ou lugar'),
      'ponto uerj',
    );
    await fireEvent.press(screen.getByText('Ponto UERJ'));
    expect(screen.getByRole('header', { name: 'Ponto UERJ' })).toBeVisible();
    expect(
      screen.getByText('R. São Francisco Xavier · perto do Portão 5'),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Linhas: 239, 363, /)).toBeVisible();
    expect(screen.getByText('+5')).toBeVisible();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Linhas e destinos' }),
    );
    expect(
      screen.getByLabelText('Linha 363, para Vila Valqueire'),
    ).toBeVisible();
    expect(
      screen.getByText(/^Linhas da Prefeitura do Rio \(SMTR\) de 03\/06\/2026/),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Como chegar a pé' }),
    ).toBeVisible();
  });

  it('lists the stops under Transporte and selects one on the map', async () => {
    await renderWithProviders(<MapScreen />);
    await fireEvent.press(screen.getByText('Transporte'));
    expect(screen.getByText('Ponto Felipe Camarão · BRS 5, 6')).toBeVisible();
    expect(screen.getByText('Metrô Maracanã')).toBeVisible();
    await fireEvent.press(screen.getByLabelText('Voltar ao mapa'));
    await fireEvent(screen.getByTestId('campus-map-plot'), 'layout', {
      nativeEvent: { layout: { width: 390, height: 430 } },
    });
    await fireEvent.press(screen.getByLabelText('No mapa: Ponto UERJ'));
    expect(screen.getByRole('header', { name: 'Ponto UERJ' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Linhas e destinos' }),
    ).toBeVisible();
  });
});
