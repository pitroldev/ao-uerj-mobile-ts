import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import type { Goal } from '@root/modules/planning/domain/models';

/**
 * Uma semana em miniatura (segunda a sexta, quatro tempos) com as aulas que
 * cada objetivo produz: o desenho diz o que a frase diria. `true` é aula; `'key'`
 * é aula de disciplina que trava outras (em destaque).
 */
type Cell = boolean | 'key';
type Week = readonly (readonly Cell[])[];

const _ = false;
const X = true;
const K = 'key';

/** Uma linha por tempo, uma coluna por dia. */
const WEEKS: Record<Goal, Week> = {
  // aulas coladas, sem buraco no meio do dia
  COMPACT: [
    [X, _, X, _, X],
    [X, _, X, _, X],
    [X, _, X, _, _],
    [_, _, _, _, _],
  ],
  // tudo em dois dias
  FEW_DAYS: [
    [_, X, _, X, _],
    [_, X, _, X, _],
    [_, X, _, X, _],
    [_, X, _, X, _],
  ],
  // pouca aula em cada dia
  LIGHT_DAYS: [
    [X, _, X, _, X],
    [_, X, _, X, _],
    [_, _, _, _, _],
    [_, _, _, _, _],
  ],
  // as que travam outras vêm primeiro
  ADVANCE: [
    [K, _, K, X, _],
    [K, _, K, X, _],
    [_, X, _, _, K],
    [_, X, _, _, K],
  ],
};

const CELL_W = 7;
const CELL_H = 5;
const GAP = 2;

const Frame = styled.View`
  width: ${5 * CELL_W + 4 * GAP + 12}px;
  height: ${4 * CELL_H + 3 * GAP + 12}px;
  padding: 6px;
  gap: ${GAP}px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
`;

const Row = styled.View`
  flex-direction: row;
  gap: ${GAP}px;
`;

const Slot = styled.View<{ $color: string }>`
  width: ${CELL_W}px;
  height: ${CELL_H}px;
  border-radius: 1.5px;
  background-color: ${({ $color }) => $color};
`;

/** O desenho do objetivo, ao lado do nome na folha "O que mais importa?". */
export function GoalGlyph({ goal, active }: { goal: Goal; active: boolean }) {
  const theme = useTheme();
  const on = active ? theme.colors.accent : theme.colors.inkSubtle;
  const colorOf = (cell: Cell) =>
    cell === 'key'
      ? theme.status.warn.ink
      : cell
        ? on
        : theme.colors.ruleStrong;
  return (
    <Frame
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {WEEKS[goal].map((row, index) => (
        <Row key={index}>
          {row.map((cell, day) => (
            <Slot key={day} $color={colorOf(cell)} />
          ))}
        </Row>
      ))}
    </Frame>
  );
}
