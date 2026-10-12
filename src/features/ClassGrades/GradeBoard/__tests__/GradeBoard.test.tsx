import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { Table, TableRow } from '@components/ui';
import type { ClassGrade } from '@root/modules/academics/domain/models';
import { LIGHT } from '@root/themes';

import GradeBoard from '../GradeBoard';

let mockWindow = { width: 412, height: 892, scale: 2.625, fontScale: 1 };

jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
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

let renderer: ReactTestRenderer;

function render() {
  act(() => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <GradeBoard data={grades} period="2026.2" />
      </ThemeProvider>,
    );
  });
}

const columns = () => renderer.root.findByType(Table).props.columns;
const texts = () =>
  renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');

afterEach(() => {
  act(() => renderer.unmount());
});

it('keeps the 45dp grade columns at the default font size', () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 1 };
  render();
  expect(renderer.root.findByType(Table).props.hideHeader).toBe(false);
  expect(columns().map((c: { width?: number }) => c.width)).toEqual([
    undefined,
    45,
    45,
    45,
    45,
  ]);
});

it('widens the grade columns with the system font so "Média" does not break', () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 1.3 };
  render();
  const widths = columns()
    .slice(1)
    .map((c: { width?: number }) => c.width as number);
  // "Média" ocupa ~2,9em da legenda (12sp) e "10,0" ~2,2em do callout (14sp).
  widths.forEach((w: number) => {
    expect(w).toBeGreaterThanOrEqual(Math.ceil(2.94 * 12 * 1.3));
    expect(w).toBeGreaterThanOrEqual(Math.ceil(2.21 * 14 * 1.3 + 12));
  });
  expect(columns().map((c: { label: string }) => c.label)).toEqual([
    'Disciplina',
    'P1',
    'P2',
    'PF',
    'Média',
  ]);
});

it('moves the grades under the name when the columns would squeeze it', () => {
  mockWindow = { ...mockWindow, width: 412, fontScale: 2 };
  render();
  expect(renderer.root.findByType(Table).props.hideHeader).toBe(true);
  // Cada nota mantém o próprio rótulo, então a coluna não se perde.
  expect(texts().filter(t => t === 'Média')).toHaveLength(2);
  expect(
    renderer.root
      .findAllByType(TableRow)
      .map(row => row.props.accessibilityLabel),
  ).toEqual([
    'Sistemas Distribuídos: P1 8,5, P2 sem nota, PF sem nota, Média sem nota. Bom na P1',
    'Ética e Computação: P1 sem nota, P2 sem nota, PF sem nota, Média 10,0. Bom na média',
  ]);
});
