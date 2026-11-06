import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';

import type { Evaluation } from '@root/modules/evaluations/domain/evaluations';
import { renderWithProviders } from '@root/test-utils/render';
import { UpcomingEvaluations } from '../UpcomingEvaluations';

const NOW = new Date(2026, 10, 23, 13, 5);

const evaluation = (patch: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1',
  subjectId: '342',
  subjectName: 'Física III',
  type: 'P1',
  date: '2026-11-24',
  time: 8 * 60,
  note: '',
  reminders: ['eve', 'day'],
  earlyTime: 20 * 60,
  dayTime: 7 * 60,
  done: false,
  ...patch,
});

// três avaliações nos próximos dias, cada uma de uma disciplina
const THREE = [
  evaluation({ id: 'a', subjectName: 'Física III', date: '2026-11-24' }),
  evaluation({ id: 'b', subjectName: 'Cálculo II', date: '2026-11-25' }),
  evaluation({ id: 'c', subjectName: 'Álgebra Linear', date: '2026-11-26' }),
];

const render = (limit?: number) =>
  renderWithProviders(
    <UpcomingEvaluations
      evaluations={THREE}
      schedule={[]}
      grades={[]}
      now={NOW}
      onAdd={jest.fn()}
      onPress={jest.fn()}
      limit={limit}
    />,
  );

it('offers "Ver todas" when the chosen limit hides some, and shows them all', async () => {
  await render(1);
  expect(screen.getByText('Física III')).toBeOnTheScreen();
  expect(screen.queryByText('Cálculo II')).toBeNull();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Ver todas (3)' }));
  expect(screen.getByText('Cálculo II')).toBeOnTheScreen();
  expect(screen.getByText('Álgebra Linear')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Mostrar menos' }),
  ).toBeOnTheScreen();
});

it('leaves "Ver todas" out when the limit already shows every one', async () => {
  await render(5);
  expect(screen.getByText('Álgebra Linear')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Ver todas/ })).toBeNull();
});

it('shows three before "Ver todas" by default', async () => {
  await render();
  expect(screen.getByText('Álgebra Linear')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Ver todas/ })).toBeNull();
});
