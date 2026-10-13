import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';

import { renderWithProviders } from '@root/test-utils/render';
import { TeacherSearch } from '../TeacherSearch';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ community: {} }),
  useIdentity: () => ({ account: { scope: 'test-account' } }),
}));
jest.mock('@hooks/useBackHandler', () => ({ useBackHandler: jest.fn() }));
jest.mock('@features/TeacherDetails/TeacherView', () => ({
  TeacherView: 'TeacherView',
}));
jest.mock('@templates/Header', () => ({ useHeaderBack: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('teacher search', () => {
  beforeEach(async () => {
    jest.mocked(useQuery).mockImplementation((options: any) =>
      options.queryKey[2] === 'teachers'
        ? ({
            data: ['Álvaro Souza', 'Ana [Teste]'],
            isLoading: false,
            error: null,
          } as any)
        : ({
            data: undefined,
            isLoading: Boolean(options.enabled),
            error: null,
          } as any),
    );
    await renderWithProviders(<TeacherSearch />);
  });

  it('treats search text literally and matches names without accents', async () => {
    const user = userEvent.setup();
    const search = screen.getByLabelText('Pesquise pelo nome do professor');
    await user.type(search, '[');
    expect(
      screen.getByRole('button', { name: 'Ana [Teste]' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Álvaro Souza')).not.toBeOnTheScreen();
    await user.clear(search);
    await user.type(search, 'alvaro');
    expect(
      screen.getByRole('button', { name: 'Álvaro Souza' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Ana [Teste]')).not.toBeOnTheScreen();
  });

  it('keeps the selected teacher while details are still loading', async () => {
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Álvaro Souza' }));
    expect(screen.getByLabelText('Carregando professor…')).toBeOnTheScreen();
    // a busca e a lista de nomes saem de cena
    expect(
      screen.queryByLabelText('Pesquise pelo nome do professor'),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText('Álvaro Souza')).not.toBeOnTheScreen();
    expect(screen.queryByText('Ana [Teste]')).not.toBeOnTheScreen();
  });
});
