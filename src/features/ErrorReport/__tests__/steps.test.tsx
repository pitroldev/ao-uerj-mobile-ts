import React from 'react';
import { Text as RNText, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import { ListRow } from '@components/ui';
import FeatureSelectionStep from '../FeatureSelectionStep';
import ExplanationStep from '../ExplanationStep';
import { FEATURES, SUBJECT_PAGE } from '../reportPages';

jest.mock('react-native-modal', () => 'Modal');

let renderer: ReactTestRenderer;
const render = async (node: React.ReactElement) => {
  await act(async () => {
    renderer = create(<ThemeProvider theme={LIGHT}>{node}</ThemeProvider>);
  });
};
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it('lists every screen as a radio and asks for the code right below the subject option', async () => {
  const onChangePage = jest.fn();
  const step = (page: string) => (
    <FeatureSelectionStep
      page={page}
      subjectCode=""
      onChangePage={onChangePage}
      onChangeSubjectCode={jest.fn()}
    />
  );
  await render(step(''));
  const rows = () => renderer.root.findAllByType(ListRow);
  expect(rows().map(r => r.props.title)).toEqual(FEATURES);
  expect(rows().every(r => r.props.accessibilityRole === 'radio')).toBe(true);
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);

  await act(async () => rows()[5].props.onPress());
  expect(onChangePage).toHaveBeenCalledWith('Quadro de Notas');

  await act(async () =>
    renderer.update(
      <ThemeProvider theme={LIGHT}>{step(SUBJECT_PAGE)}</ThemeProvider>,
    ),
  );
  const selected = rows().find(r => r.props.title === SUBJECT_PAGE)!;
  expect(selected.props.accessibilityState).toEqual({ checked: true });
  const input = renderer.root.findByType(TextInput);
  expect(input.props.accessibilityLabel).toBe('Insira o código da disciplina');
  expect(input.props.placeholder).toBe('Ex.: IME02-01388');
});

it('shows the chosen screen as context for the description', async () => {
  await render(
    <ExplanationStep
      page={SUBJECT_PAGE}
      subjectCode="IME02-01388"
      description=""
      onChangeDescription={jest.fn()}
    />,
  );
  const texts = renderer.root.findAllByType(RNText).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c ?? '');
  });
  expect(texts).toContain('Descreva o que aconteceu e o resultado esperado');
  expect(texts).toContain(`Tela: ${SUBJECT_PAGE} · IME02-01388`);
  expect(renderer.root.findByType(TextInput).props.maxLength).toBe(4000);
});
