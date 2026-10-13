import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Text } from '../Text';

export type TabItem<T extends string> = {
  value: T;
  label: string;
};

export type TabsProps<T extends string> = {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  flex-direction: row;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const Tab = styled.Pressable`
  flex: 1;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  align-items: center;
  justify-content: center;
`;

const Indicator = styled.View`
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: -1px;
  height: 3px;
  border-top-left-radius: 3px;
  border-top-right-radius: 3px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

/**
 * Abas com sublinhado (".tabs"): rótulos 14 semibold, a ativa em acento com
 * um traço de 3dp. Ex.: "Informações / Horários" no gerador.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
  style,
}: TabsProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Root
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {tabs.map(tab => {
        const selected = tab.value === value;
        return (
          <Tab
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) =>
              pressed && { backgroundColor: c.surfaceMuted }
            }
          >
            <Text
              weight="semibold"
              color={selected ? c.accent : c.inkMuted}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {selected ? <Indicator /> : null}
          </Tab>
        );
      })}
    </Root>
  );
}
