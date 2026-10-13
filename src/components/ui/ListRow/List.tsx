import React from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

export type ListProps = {
  children?: React.ReactNode;
  /**
   * Sangra até as bordas do painel (margem negativa igual à margem lateral),
   * como ".rows" no protótipo. Desligue dentro de cards.
   */
  bleed?: boolean;
  /** Mantém o fio do último item. */
  lastDivider?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View<{ $bleed: boolean }>`
  margin: 0px ${({ theme, $bleed }) => ($bleed ? -theme.layout.gutter : 0)}px;
`;

const Separator = styled.View<{ $inset?: number }>`
  height: ${({ theme }) => theme.borders.hairline}px;
  margin-left: ${({ theme, $inset }) => $inset ?? theme.layout.gutter}px;
  background-color: ${({ theme }) => theme.colors.rule};
`;

/**
 * Grupo de `ListRow`: sangra até as bordas e remove o fio do último item.
 * Para listas longas use `FlatList` com `ListRow` e `ListSeparator`.
 */
export function List({
  children,
  bleed = true,
  lastDivider = false,
  accessibilityRole,
  accessibilityLabel,
  style,
}: ListProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <Root
      $bleed={bleed}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {items.map((child, i) => {
        const el = child as React.ReactElement<{ divider?: boolean }>;
        if (
          i === items.length - 1 &&
          !lastDivider &&
          el.props.divider === undefined
        ) {
          return React.cloneElement(el, { divider: false });
        }
        return el;
      })}
    </Root>
  );
}

/**
 * Separador para `FlatList` (`ItemSeparatorComponent`) com
 * `ListRow divider={false}`. Recuo padrão de 20.
 */
export function ListSeparator({ inset }: { inset?: number }) {
  return (
    <Separator
      $inset={inset}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
