import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import ErrorBoundary from '../ErrorBoundary';

let renderer: ReactTestRenderer;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  consoleError.mockRestore();
});

it('renders and recovers from a child failure without any theme or app provider', async () => {
  let fail = true;
  const Child = () => {
    if (fail) throw new Error('Falha de renderização de teste');
    return <Text>Aplicativo recuperado</Text>;
  };
  await act(async () => {
    renderer = create(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    );
  });
  expect(
    renderer.root.findAllByType(Text).map(node => node.props.children),
  ).toContain('Oops! Algo deu errado');
  fail = false;
  await act(async () =>
    renderer.root.findByType(TouchableOpacity).props.onPress(),
  );
  expect(renderer.root.findByType(Text).props.children).toBe(
    'Aplicativo recuperado',
  );
});
