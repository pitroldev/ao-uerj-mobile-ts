import React from 'react';
import { Linking, Text as RNText } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import Toast from 'react-native-toast-message';

import { LIGHT } from '@root/themes';
import { Button, ListRow } from '@components/ui';
import About from '../About';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('@features/ErrorReport/ErrorReportModal', () => 'ErrorReportModal');

let renderer: ReactTestRenderer;
const flatten = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(flatten).join('')
    : typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : '';

beforeEach(async () => {
  jest.mocked(Linking.openURL).mockReset().mockResolvedValue(true);
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <About />
      </ThemeProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

const row = (title: string) =>
  renderer.root.findAllByType(ListRow).find(r => r.props.title === title)!;
const button = (label: string) =>
  renderer.root.findAllByType(Button).find(b => b.props.label === label)!;

it('shows the app identity, the unofficial notice and the sections', () => {
  const texts = renderer.root
    .findAllByType(RNText)
    .map(t => flatten(t.props.children));
  expect(texts).toEqual(
    expect.arrayContaining([
      'AO UERJ',
      expect.stringMatching(/^Versão \d+\.\d+\.\d+$/),
      'Suporte',
      'Contribua',
      'Este projeto é open source e aceita contribuições!',
      'Desenvolvedor',
      'Petro Cardoso',
    ]),
  );
  expect(texts.some(t => t.startsWith('Aplicativo não oficial'))).toBe(true);
});

it('opens the report sheet from "Reportar problema"', async () => {
  const sheet = () => renderer.root.findByType('ErrorReportModal' as never);
  expect(sheet().props.visible).toBe(false);
  await act(async () => row('Reportar problema').props.onPress());
  expect(sheet().props.visible).toBe(true);
  await act(async () => sheet().props.setVisibility(false));
  expect(sheet().props.visible).toBe(false);
});

it('opens the support, repository and developer links', async () => {
  await act(async () => row('Sugerir melhoria').props.onPress());
  await act(async () => row('Ver repositório').props.onPress());
  await act(async () => button('LinkedIn').props.onPress());
  await act(async () => button('Email').props.onPress());
  expect(jest.mocked(Linking.openURL).mock.calls.map(c => c[0])).toEqual([
    'https://github.com/pitroldev/ao-uerj-mobile-ts/issues',
    'https://github.com/pitroldev/ao-uerj-mobile-ts',
    'https://www.linkedin.com/in/petrocardoso/',
    'mailto:contato@pitrol.dev?subject=AO UERJ',
  ]);
});

it('tells the student when a link cannot be opened', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('sem app'));
  await act(async () => button('GitHub').props.onPress());
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  log.mockRestore();
});
