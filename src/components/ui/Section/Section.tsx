import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

type SectionHeaderProps = {
  title: string;
  /**
   * Elemento à direita: normalmente um `Button variant="text" size="sm"`
   * ("Compartilhar grade") ou um `IconButton` (engrenagem).
   */
  action?: React.ReactNode;
  /** Nota à direita em texto secundário ("6 turmas", "Período de inscrição"). */
  note?: React.ReactNode;
  /** Ícone da nota. */
  noteIcon?: IconName;
  /** Remove a margem inferior padrão (10). */
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HeaderRow = styled.View<{ $dense: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: ${({ theme }) => theme.layout.sectionHeaderMinHeight}px;
  margin-bottom: ${({ theme, $dense }) =>
    $dense ? 0 : theme.layout.sectionHeaderGap}px;
`;

const Title = styled(Text)`
  flex-shrink: 1;
`;

const Note = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

/**
 * Margens negativas: o alvo de 48dp da ação não aumenta a linha de 32 e o
 * texto do botão alinha com a margem lateral.
 */
const Action = styled.View`
  flex-shrink: 0;
  margin: -8px -10px -8px 0;
`;

const SectionRoot = styled.View<{ $first: boolean }>`
  margin-top: ${({ theme, $first }) =>
    $first ? 0 : theme.layout.sectionGap}px;
`;

const Description = styled(Text)`
  margin-top: -4px;
  margin-bottom: 8px;
`;

/** Título de seção (17/24 semibold) com ação ou nota à direita. */
function SectionHeader({
  title,
  action,
  note,
  noteIcon,
  dense = false,
  style,
}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <HeaderRow $dense={dense} style={style}>
      <Title variant="headline" accessibilityRole="header">
        {title}
      </Title>
      {note != null ? (
        <Note>
          {noteIcon ? (
            <Icon
              name={noteIcon}
              size={theme.sizes.icon.md}
              color={theme.colors.inkMuted}
            />
          ) : null}
          {typeof note === 'string' ? (
            <Text variant="meta" weight="medium" tone="muted">
              {note}
            </Text>
          ) : (
            note
          )}
        </Note>
      ) : null}
      {action ? <Action>{action}</Action> : null}
    </HeaderRow>
  );
}

export type SectionProps = SectionHeaderProps & {
  children?: React.ReactNode;
  /** Primeira seção da tela: sem a margem superior de 30. */
  first?: boolean;
  /** Linha de apoio abaixo do título (".sec-p"). */
  description?: string;
  /** Estilo do contêiner externo. */
  containerStyle?: StyleProp<ViewStyle>;
};

/** Seção da tela: margem superior de 30, `SectionHeader` e conteúdo. */
export function Section({
  children,
  first = false,
  description,
  containerStyle,
  ...header
}: SectionProps) {
  return (
    <SectionRoot $first={first} style={containerStyle}>
      <SectionHeader {...header} />
      {description ? (
        <Description tone="muted">{description}</Description>
      ) : null}
      {children}
    </SectionRoot>
  );
}
