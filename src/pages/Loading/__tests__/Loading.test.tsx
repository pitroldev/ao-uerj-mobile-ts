import React from 'react';
import { screen } from '@testing-library/react-native';

import { LIGHT } from '@root/themes';
import { renderWithProviders } from '@root/test-utils/render';
import { LoadingPage } from '../Loading';

it('shows the logo, the waiting message and an indeterminate bar on the blue', async () => {
  await renderWithProviders(<LoadingPage />);
  // o logo é anunciado como "AO UERJ"
  expect(screen.getByRole('image', { name: 'AO UERJ' })).toBeOnTheScreen();
  expect(
    screen.getByText('Aguarde um momento enquanto carregamos os dados...'),
  ).toHaveProp('accessibilityLiveRegion', 'polite');
  // a barra é decorativa (fora da acessibilidade); o trilho no tom `onBrand`
  // é o que a distingue da barra de acento das outras telas
  expect(
    screen.getByTestId('loading-bar', { includeHiddenElements: true }),
  ).toHaveStyle({ width: 120, backgroundColor: LIGHT.colors.onBrandTrack });
});
