import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import { LoadingBar } from '@components/ui';
import LoadingPage from '../Loading';

jest.mock('react-native-modal', () => 'Modal');

it('shows the logo, the waiting message and an indeterminate bar on the blue', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <LoadingPage />
      </ThemeProvider>,
    );
  });
  // o logo é anunciado como "AO UERJ"
  expect(
    renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'AO UERJ' &&
        node.props.accessibilityRole === 'image',
    ).length,
  ).toBeGreaterThan(0);
  const message = renderer.root.findByType(Text);
  expect(message.props.children).toBe(
    'Aguarde um momento enquanto carregamos os dados...',
  );
  expect(message.props.accessibilityLiveRegion).toBe('polite');
  expect(renderer.root.findByType(LoadingBar).props.tone).toBe('onBrand');
  await act(async () => renderer.unmount());
});
