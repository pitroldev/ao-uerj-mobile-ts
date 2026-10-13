import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@root/test-utils/render';
import { FeatureSelectionStep } from '../FeatureSelectionStep';
import { ExplanationStep } from '../ExplanationStep';
import { FEATURES, SUBJECT_PAGE } from '../reportPages';

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
  await renderWithProviders(step(''));
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(FEATURES.length);
  FEATURES.forEach((name, i) => expect(radios[i]).toHaveAccessibleName(name));
  expect(
    screen.queryByLabelText('Insira o código da disciplina'),
  ).not.toBeOnTheScreen();

  await userEvent
    .setup()
    .press(screen.getByRole('radio', { name: 'Quadro de Notas' }));
  expect(onChangePage).toHaveBeenCalledWith('Quadro de Notas');

  await screen.rerender(step(SUBJECT_PAGE));
  expect(screen.getByRole('radio', { name: SUBJECT_PAGE })).toBeChecked();
  expect(screen.getByPlaceholderText('Ex.: IME02-01388')).toHaveAccessibleName(
    'Insira o código da disciplina',
  );
});

it('shows the chosen screen as context for the description', async () => {
  await renderWithProviders(
    <ExplanationStep
      page={SUBJECT_PAGE}
      subjectCode="IME02-01388"
      description=""
      onChangeDescription={jest.fn()}
    />,
  );
  expect(
    screen.getByText('Descreva o que aconteceu e o resultado esperado'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(`Tela: ${SUBJECT_PAGE} · IME02-01388`),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText('Descreva o que aconteceu e o resultado esperado'),
  ).toHaveProp('maxLength', 4000);
});
