import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import { LIGHT } from '@root/themes';
import SmallDummyMessage from '../SmallDummyMessage';

jest.mock('@react-native-vector-icons/ant-design', () => ({
  AntDesign: 'Icon',
}));
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it.each([
  [undefined, 16],
  [false, 0],
] as const)(
  'keeps the padding default with the React 19 JSX runtime (%s)',
  async (withPadding, expectedPadding) => {
    await act(async () => {
      renderer = create(
        <ThemeProvider theme={LIGHT}>
          <SmallDummyMessage
            type="INFO"
            text="Informação"
            withPadding={withPadding}
          />
        </ThemeProvider>,
      );
    });
    const button = renderer.root.findByType(TouchableOpacity);
    expect(StyleSheet.flatten(button.props.style).paddingLeft).toBe(
      expectedPadding,
    );
  },
);
