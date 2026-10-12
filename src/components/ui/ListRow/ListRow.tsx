import React from 'react';
import type {
  AccessibilityRole,
  AccessibilityState,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import styled, { css, useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type ListRowProps = {
  /** Nome em destaque (15/21 semibold). */
  title: React.ReactNode;
  /** `regular` para opções simples (rádio, interruptor): 15/21 normal. */
  titleWeight?: 'semibold' | 'medium' | 'regular';
  titleLines?: number;
  /** Código da disciplina, mostrado no início da linha de metadados. */
  code?: string;
  /** Primeira linha de metadados (13/18, secundária). Junta com `code` por " · ". */
  subtitle?: React.ReactNode;
  /** Linhas extras de metadados (cada string vira uma linha 13/18). */
  meta?: React.ReactNode | React.ReactNode[];
  /** Fatos em linha (status + texto), com espaçamento 4/12 (".r-facts"). */
  facts?: React.ReactNode;
  /** Conteúdo adicional abaixo (Tag, ProgressBar…). */
  children?: React.ReactNode;

  /** Elemento à esquerda (Checkbox, Radio, IconTile, Avatar). */
  leading?: React.ReactNode;
  /** Ícone simples à esquerda (20, secundário), como o "history" da pesquisa. */
  leadingIcon?: IconName;
  /** Alinhamento do elemento à esquerda. */
  leadingAlign?: 'center' | 'start';
  /** Elemento à direita (Switch, texto, botão). */
  trailing?: React.ReactNode;
  /** Texto curto à direita, secundário e tabular ("CR 7,77"). */
  aside?: string;
  /** Seta `chevron_right` à direita (navega). */
  chevron?: boolean;
  /** Ícone `open_in_new` à direita (abre fora do app). */
  external?: boolean;

  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Fundo de acento suave (item em foco, como a aula tocada na folha). */
  highlighted?: boolean;
  /** Fio inferior. O `List` remove o do último item. */
  divider?: boolean;
  /** Recuo horizontal do conteúdo e do fio (20 na tela, 14 dentro de card). */
  inset?: number;
  /** Padding vertical 10 em vez de 12. */
  dense?: boolean;

  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

type RowStyle = { $pad: number; $dense: boolean; $highlighted: boolean };

const row = css<RowStyle>`
  flex-direction: row;
  align-items: center;
  gap: 14px;
  min-height: ${({ theme }) => theme.sizes.row}px;
  padding: ${({ $dense }) => ($dense ? 10 : 12)}px ${({ $pad }) => $pad}px;
  background-color: ${({ theme, $highlighted }) =>
    $highlighted ? theme.colors.accentSoft : 'transparent'};
`;

const StaticRow = styled.View<RowStyle>`
  ${row}
`;

const PressableRow = styled.Pressable<RowStyle>`
  ${row}
`;

const Leading = styled.View<{ $start: boolean }>`
  align-self: ${({ $start }) => ($start ? 'flex-start' : 'center')};
`;

const Main = styled.View`
  flex: 1;
  min-width: 0px;
  gap: 2px;
`;

const Facts = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 12px;
  row-gap: 4px;
  margin-top: 4px;
`;

const Extra = styled.View`
  margin-top: 4px;
`;

const Aside = styled(Text)`
  flex-shrink: 0;
`;

const Line = styled.View<{ $pad: number }>`
  position: absolute;
  left: ${({ $pad }) => $pad}px;
  right: 0px;
  bottom: 0px;
  height: ${({ theme }) => theme.borders.hairline}px;
  background-color: ${({ theme }) => theme.colors.rule};
`;

function metaLines(meta: ListRowProps['meta']) {
  if (meta == null || meta === false) return [];
  return Array.isArray(meta) ? meta : [meta];
}

/**
 * Linha de lista com fio inferior (o elemento mais comum do sistema): título,
 * código e metadados, fatos com status, e acessório à esquerda/direita.
 * Use dentro de `List`, que sangra até as bordas do painel.
 */
export function ListRow({
  title,
  titleWeight = 'semibold',
  titleLines,
  code,
  subtitle,
  meta,
  facts,
  children,
  leading,
  leadingIcon,
  leadingAlign = 'center',
  trailing,
  aside,
  chevron = false,
  external = false,
  onPress,
  onLongPress,
  disabled,
  highlighted = false,
  divider = true,
  inset,
  dense = false,
  accessibilityRole,
  accessibilityState,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ListRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const pad = inset ?? theme.layout.gutter;
  const interactive = Boolean(onPress || onLongPress);
  const firstMeta = [code, subtitle].filter(
    part => part != null && part !== false && part !== '',
  );

  const content = (
    <>
      {leading ? (
        <Leading $start={leadingAlign === 'start'}>{leading}</Leading>
      ) : null}
      {leadingIcon ? (
        <Icon
          name={leadingIcon}
          size={theme.sizes.icon.lg}
          color={c.inkMuted}
        />
      ) : null}
      <Main>
        {typeof title === 'string' ? (
          <Text variant="body" weight={titleWeight} numberOfLines={titleLines}>
            {title}
          </Text>
        ) : (
          title
        )}
        {firstMeta.length ? (
          <Text variant="meta" tone="muted">
            {firstMeta.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 ? ' · ' : ''}
                {part}
              </React.Fragment>
            ))}
          </Text>
        ) : null}
        {metaLines(meta).map((line, i) =>
          typeof line === 'string' || typeof line === 'number' ? (
            <Text key={i} variant="meta" tone="muted">
              {line}
            </Text>
          ) : (
            <React.Fragment key={i}>{line}</React.Fragment>
          ),
        )}
        {facts ? <Facts>{facts}</Facts> : null}
        {children ? <Extra>{children}</Extra> : null}
      </Main>
      {aside ? (
        <Aside tone="muted" tabular>
          {aside}
        </Aside>
      ) : null}
      {trailing}
      {chevron ? (
        <Icon
          name="chevron_right"
          size={theme.sizes.icon.lg}
          color={c.inkMuted}
        />
      ) : null}
      {external ? (
        <Icon
          name="open_in_new"
          size={theme.sizes.icon.lg}
          color={c.inkMuted}
        />
      ) : null}
      {divider ? (
        <Line
          $pad={pad}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <StaticRow
        $pad={pad}
        $dense={dense}
        $highlighted={highlighted}
        style={style}
        testID={testID}
        accessible={Boolean(accessibilityLabel) || undefined}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </StaticRow>
    );
  }

  return (
    <PressableRow
      $pad={pad}
      $dense={dense}
      $highlighted={highlighted}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{
        disabled: Boolean(disabled),
        ...accessibilityState,
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        pressed && !highlighted && { backgroundColor: c.surfaceMuted },
        style,
      ]}
    >
      {content}
    </PressableRow>
  );
}

export default ListRow;
