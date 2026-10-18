import React from 'react';
import { StyleSheet } from 'react-native';
import { screen, userEvent, within } from '@testing-library/react-native';

import type { ClassGrade } from '@root/modules/academics/domain/models';
import { renderWithProviders } from '@root/test-utils/render';

import { GradeBoard } from '../GradeBoard';

let mockWindow = { width: 412, height: 892, scale: 2.625, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));
// a folha da simulação lê o histórico e os créditos (CR)
jest.mock('@root/modules/academics/presentation/useSubjectLoads', () => ({
  useSubjectLoads: () => ({
    loads: new Map(),
    history: { data: [], isLoading: false, error: null },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const grades = [
  {
    id: 1,
    name: 'Sistemas Distribuídos',
    grades: { p1: 8.5, p2: null, pf: null, result: null },
  },
  {
    id: 2,
    name: 'Ética e Computação',
    grades: { p1: null, p2: null, pf: null, result: 10 },
  },
] as unknown as ClassGrade[];

const COLUMNS = ['Disciplina', 'P1', 'P2', 'PF', 'Média'];

const renderBoard = () =>
  renderWithProviders(<GradeBoard data={grades} period="2026.2" />);

// a largura da coluna fica na célula do cabeçalho que envolve o rótulo
const headerCell = (label: string) => screen.getByText(label).parent!;
const widthOf = (label: string): number =>
  StyleSheet.flatten(headerCell(label).props.style).width;

it('keeps the 45dp grade columns at the default font size', async () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 1 };
  await renderBoard();
  // cabeçalho visível: o nome ocupa o que sobra e cada nota tem 45dp
  expect(headerCell('Disciplina')).toHaveStyle({ flexGrow: 1 });
  expect(headerCell('Disciplina')).not.toHaveStyle({
    width: expect.anything(),
  });
  for (const label of COLUMNS.slice(1)) {
    expect(headerCell(label)).toHaveStyle({ width: 45 });
  }
});

it('widens the grade columns with the system font so "Média" does not break', async () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 1.3 };
  await renderBoard();
  // "Média" ocupa ~2,9em da legenda (12sp) e "10,0" ~2,2em do callout (14sp).
  COLUMNS.slice(1).forEach(label => {
    expect(widthOf(label)).toBeGreaterThanOrEqual(Math.ceil(2.94 * 12 * 1.3));
    expect(widthOf(label)).toBeGreaterThanOrEqual(
      Math.ceil(2.21 * 14 * 1.3 + 12),
    );
  });
  const header = screen.getAllByText(/^(Disciplina|P1|P2|PF|Média)$/);
  expect(header).toHaveLength(COLUMNS.length);
  COLUMNS.forEach((label, i) => expect(header[i]).toHaveTextContent(label));
});

it('moves the grades under the name when the columns would squeeze it', async () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 2 };
  await renderBoard();
  expect(screen.queryByText('Disciplina')).not.toBeOnTheScreen();
  // Cada nota mantém o próprio rótulo, então a coluna não se perde.
  expect(screen.getAllByText('Média')).toHaveLength(2);
  // o leitor de tela lê cada linha inteira, na ordem da tabela
  const rows = screen.getAllByLabelText(/: P1 /);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveAccessibleName(
    'Sistemas Distribuídos: P1 8,5, P2 sem nota, PF sem nota, Média sem nota. 5,5 na P2 dispensa a PF',
  );
  expect(rows[1]).toHaveAccessibleName(
    'Ética e Computação: P1 sem nota, P2 sem nota, PF sem nota, Média 10,0. Média final 10,0',
  );
});

describe('quanto preciso na PF', () => {
  const period = [
    {
      id: 'IME02-00777',
      name: 'Cálculo II',
      grades: { p1: 5.5, p2: 6.1, pf: null, result: null },
    },
    {
      id: 'IME02-00778',
      name: 'Física Experimental II',
      grades: { p1: 8, p2: 7.4, pf: null, result: null },
    },
    {
      id: 'IME02-00779',
      name: 'Álgebra Linear',
      grades: { p1: 3.2, p2: 4, pf: null, result: null },
    },
  ] as unknown as ClassGrade[];

  beforeEach(() => {
    mockWindow = { ...mockWindow, width: 412, fontScale: 1 };
  });

  it('draws the needed final exam grade dashed and says what each subject needs', async () => {
    await renderWithProviders(<GradeBoard data={period} period="2026.1" />);
    expect(screen.getByText('Precisa de 4,2 na PF')).toBeOnTheScreen();
    expect(screen.getByText('Dispensado da PF')).toBeOnTheScreen();
    expect(screen.getByText('Sem direito à PF')).toBeOnTheScreen();
    const target = screen.getByLabelText('PF necessária 4,2');
    expect(target).toHaveStyle({ borderStyle: 'dashed' });
    expect(screen.getByText('Necessária na PF')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Cálculo II: P1 5,5, P2 6,1, PF necessária 4,2, Média sem nota. Precisa de 4,2 na PF',
      ),
    ).toBeOnTheScreen();
  });

  it('opens the simulation from the board', async () => {
    await renderWithProviders(<GradeBoard data={period} period="2026.1" />);
    await userEvent.press(
      screen.getByRole('button', { name: 'Simular PF e CR' }),
    );
    expect(
      screen.getByRole('header', { name: 'Simular PF e CR' }),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByLabelText('PF de Cálculo II: 4,2')).getByText('4,2'),
    ).toBeOnTheScreen();
  });

  it('says whether a published average passes, never rounding it up to 5,0', async () => {
    await renderWithProviders(
      <GradeBoard
        data={
          [
            {
              id: 'IME02-00777',
              name: 'Cálculo II',
              grades: { p1: 5.5, p2: 4.3, pf: 4.1, result: 4.95 },
            },
          ] as unknown as ClassGrade[]
        }
      />,
    );
    expect(screen.getByText('Média final 4,95')).toBeOnTheScreen();
    expect(screen.getByText('4,95')).toBeOnTheScreen();
    expect(screen.queryByText('5,0')).not.toBeOnTheScreen();
  });

  it('has nothing to simulate before both exams', async () => {
    await renderWithProviders(
      <GradeBoard
        data={
          [
            {
              id: 'IME02-00777',
              name: 'Cálculo II',
              grades: { p1: 5.5, p2: null, pf: null, result: null },
            },
          ] as unknown as ClassGrade[]
        }
      />,
    );
    expect(screen.getByText('8,5 na P2 dispensa a PF')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Simular PF e CR' }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText('Necessária na PF')).not.toBeOnTheScreen();
  });
});
