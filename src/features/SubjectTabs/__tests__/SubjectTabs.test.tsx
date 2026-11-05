import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@root/test-utils/render';
import { SubjectTabs } from '../SubjectTabs';
import {
  isSubjectRoute,
  lastSubjectRoute,
  rememberSubjectRoute,
} from '../subjectRoutes';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

afterEach(() => {
  rememberSubjectRoute('Disciplinas Realizadas');
  mockNavigate.mockClear();
});

it('switches between the three subject screens and remembers the last one', async () => {
  const user = userEvent.setup();
  await renderWithProviders(<SubjectTabs current="Disciplinas Realizadas" />);
  expect(screen.getByText('Realizadas')).toBeOnTheScreen();
  expect(screen.getByText('Do currículo')).toBeOnTheScreen();
  await user.press(screen.getByText('Universais'));
  expect(mockNavigate).toHaveBeenCalledWith('Disciplinas Universais');
  expect(lastSubjectRoute()).toBe('Disciplinas Universais');
  // a aba aberta não navega de novo
  await user.press(screen.getByText('Realizadas'));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('knows which routes are its tabs', () => {
  expect(isSubjectRoute('Disciplinas do Currículo')).toBe(true);
  expect(isSubjectRoute('Pesquisa de Disciplinas')).toBe(false);
});
