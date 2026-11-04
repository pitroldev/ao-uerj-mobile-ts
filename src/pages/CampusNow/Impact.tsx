import React from 'react';
import styled from 'styled-components/native';

import { Text } from '@components/ui';

const Row = styled.View<{ $first: boolean }>`
  flex-direction: row;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md}px;
  padding: ${({ theme }) => theme.spacing.sm + 2}px 0px;
  border-top-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

const Value = styled(Text)`
  min-width: 64px;
  text-align: right;
`;

const Label = styled(Text)`
  flex: 1;
`;

export type ImpactItem = { value: string; label: string };

/**
 * Números grandes com o que eles contam ao lado ("312 vezes que alguém viu
 * um aviso seu"): a semana do aluno e a do campus.
 */
export function Impact({ items }: { items: readonly ImpactItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        <Row
          key={item.label}
          $first={index === 0}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
        >
          <Value variant="titleM" tabular>
            {item.value}
          </Value>
          <Label tone="muted">{item.label}</Label>
        </Row>
      ))}
    </>
  );
}
