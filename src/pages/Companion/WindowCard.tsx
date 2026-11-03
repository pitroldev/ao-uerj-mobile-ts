import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { Card, Icon, Text } from '@components/ui';
import { splitLocation } from '@features/AttendedClassesSchedule/scheduleFormat';
import type { FreeWindow } from '@root/modules/companion/domain/window';

const Row = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Body = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const pad = (value: number) => String(value).padStart(2, '0');
/** "13:50" a partir dos minutos do dia. */
export const minuteText = (minute: number) =>
  `${Math.floor(minute / 60)}:${pad(minute % 60)}`;

const roomOf = (location: string) => splitLocation(location).room;

/** O título e a linha de baixo da janela do dia. */
export function windowText(window: FreeWindow): { title: string; sub: string } {
  switch (window.kind) {
    case 'class':
      return {
        title: `Em aula até ${minuteText(window.current.end)}`,
        sub: `${window.current.name}, ${roomOf(window.current.room)}`,
      };
    case 'free':
      return {
        title: `Você está livre até ${minuteText(window.next.start)}`,
        sub: `Depois: ${window.next.name}, ${roomOf(window.next.room)}`,
      };
    case 'done':
      return {
        title: `Sua última aula acabou às ${minuteText(window.last.end)}`,
        sub: window.last.name,
      };
    default:
      return {
        title: 'Sem aula hoje na sua grade',
        sub: 'Abra uma mesa ou um grupo para a hora que quiser.',
      };
  }
}

/**
 * A janela do dia, tirada da grade salva no aparelho: livre até a próxima
 * aula, em aula ou a última aula que acabou. O servidor não a vê.
 */
export function WindowCard({ window }: { window: FreeWindow }) {
  const theme = useTheme();
  const { title, sub } = windowText(window);
  return (
    <Card accessible accessibilityLabel={`${title}. ${sub}`}>
      <Row>
        <Icon
          name={window.kind === 'done' ? 'bedtime' : 'schedule'}
          size={theme.sizes.icon.xl}
          color={theme.colors.accent}
        />
        <Body>
          <Text weight="semibold">{title}</Text>
          {sub ? (
            <Text variant="meta" tone="muted">
              {sub}
            </Text>
          ) : null}
        </Body>
      </Row>
    </Card>
  );
}
