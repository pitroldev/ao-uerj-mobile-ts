import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type PropertyItem = {
  label: string;
  value: React.ReactNode;
  /** Valor numérico (algarismos tabulares). */
  tabular?: boolean;
};

export type PropertyListProps = {
  items: PropertyItem[];
  /**
   * `aligned`: rótulo numa coluna de 128 à esquerda e valor ao lado (".props",
   * propriedades da disciplina). `spread`: rótulo à esquerda e valor em
   * negrito à direita (".sum", resumo do gerador).
   */
  layout?: 'aligned' | 'spread';
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

const Row = styled.View<{ $spread: boolean }>`
  flex-direction: row;
  align-items: ${({ $spread }) => ($spread ? 'center' : 'baseline')};
  justify-content: ${({ $spread }) =>
    $spread ? 'space-between' : 'flex-start'};
  gap: 12px;
  min-height: 40px;
  padding: ${({ $spread }) => ($spread ? 12 : 10)}px 0px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const Label = styled(Text)<{ $spread: boolean }>`
  ${({ $spread }) => ($spread ? 'flex-shrink: 1;' : 'width: 128px;')}
`;

const AlignedValue = styled(Text)`
  flex: 1;
  line-height: 20px;
`;

/** Lista de propriedades com fios (como as propriedades de um evento). */
export function PropertyList({
  items,
  layout = 'aligned',
  style,
}: PropertyListProps) {
  const spread = layout === 'spread';
  return (
    <Root style={style}>
      {items.map(item => {
        const { value } = item;
        const plain = typeof value === 'string' || typeof value === 'number';
        return (
          <Row
            key={item.label}
            $spread={spread}
            accessible={plain || undefined}
            accessibilityLabel={plain ? `${item.label}: ${value}` : undefined}
          >
            <Label tone="muted" $spread={spread}>
              {item.label}
            </Label>
            {plain ? (
              spread ? (
                <Text weight="semibold" tabular={item.tabular}>
                  {item.value}
                </Text>
              ) : (
                <AlignedValue
                  variant="body"
                  weight="medium"
                  tabular={item.tabular}
                >
                  {item.value}
                </AlignedValue>
              )
            ) : (
              item.value
            )}
          </Row>
        );
      })}
    </Root>
  );
}

export type StatItem = { value: string; label: string };

const Stats = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const Stat = styled.View<{ $first: boolean }>`
  flex: 1;
  gap: 2px;
  padding: 14px 16px;
  border-left-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
`;

/**
 * Números de destaque lado a lado num card (".stats"): "54 Disciplinas
 * concluídas | 7,77 CR aproximado".
 */
export function StatGroup({
  items,
  style,
}: {
  items: StatItem[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Stats style={style}>
      {items.map((item, i) => (
        <Stat
          key={item.label}
          $first={i === 0}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <Text variant="display" tabular>
            {item.value}
          </Text>
          <Text variant="meta" tone="muted">
            {item.label}
          </Text>
        </Stat>
      ))}
    </Stats>
  );
}

const Note = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
`;

const NoteText = styled(Text)`
  flex: 1;
`;

/** Nota de rodapé com ícone (".foot-note"): explicações curtas, como "CR aproximado". */
export function FootNote({
  text,
  icon = 'info',
  style,
}: {
  text: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Note style={style}>
      <Icon
        name={icon}
        size={theme.sizes.icon.md}
        color={theme.colors.inkMuted}
      />
      <NoteText variant="meta" tone="muted">
        {text}
      </NoteText>
    </Note>
  );
}
