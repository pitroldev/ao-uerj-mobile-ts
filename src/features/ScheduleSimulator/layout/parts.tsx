import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, Text, type IconName } from '@components/ui';

/* ---------------------------------------------------------------- StepIntro */

const Description = styled(Text)`
  margin-top: 6px;
`;

/** Título do passo (".step-t", 20/26) e a explicação abaixo (".step-d"). */
export function StepIntro({
  title,
  description,
  live = false,
}: {
  title: string;
  description?: string;
  /** Anuncia o título quando ele muda (carregamento do passo 5). */
  live?: boolean;
}) {
  return (
    <>
      <Text
        variant="titleM"
        accessibilityRole="header"
        accessibilityLiveRegion={live ? 'polite' : undefined}
      >
        {title}
      </Text>
      {description ? (
        <Description tone="muted">{description}</Description>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- SubHeading */

const SubRow = styled.View`
  flex-direction: row;
  align-items: baseline;
  gap: 6px;
  margin: 24px 0px 10px;
`;

/** Subtítulo dentro do passo (".sub-h"), com nota opcional ("3 ligadas"). */
export function SubHeading({ title, note }: { title: string; note?: string }) {
  return (
    <SubRow>
      <Text variant="body" weight="semibold" accessibilityRole="header">
        {title}
      </Text>
      {note ? (
        <Text variant="meta" weight="medium" tone="muted">
          {note}
        </Text>
      ) : null}
    </SubRow>
  );
}

/* ---------------------------------------------------------------- CountLine */

const CountRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  column-gap: 12px;
  margin: 16px 0px 4px;
`;

/** Número em destaque dentro de uma linha de contagem. */
export function Strong({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="meta" weight="semibold" tabular>
      {children}
    </Text>
  );
}

/**
 * Linha de contagem acima de listas (".count"): "6 selecionadas · mínimo 4"
 * à esquerda e "Exibindo 15 disciplinas" à direita.
 */
export function CountLine({
  left,
  right,
  style,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <CountRow style={style}>
      <Text variant="meta" tone="muted" accessibilityLiveRegion="polite">
        {left}
      </Text>
      {right ? (
        <Text variant="meta" tone="muted">
          {right}
        </Text>
      ) : null}
    </CountRow>
  );
}

/* ----------------------------------------------------------------- ListHead */

const Head = styled.View`
  padding: 0px ${({ theme }) => theme.layout.gutter}px;
`;

/**
 * Cabeçalho de uma `FlatList` de passo: devolve as margens laterais que a
 * lista (sem padding lateral, para as linhas sangrarem) não tem.
 */
export function ListHead({ children }: { children: React.ReactNode }) {
  return <Head>{children}</Head>;
}

/**
 * Estilo do conteúdo das listas dos passos: 32 no topo e 40 no fim (o rodapé
 * fixo já cuida da área segura), sem padding lateral, para as linhas
 * sangrarem até as bordas como no ".rows" do protótipo.
 */
export function useStepListStyle(): ViewStyle {
  const theme = useTheme();
  return {
    paddingTop: theme.layout.panelPaddingTop,
    paddingBottom: theme.layout.panelPaddingBottom,
  };
}

/* ------------------------------------------------------------- FooterStatus */

const StatusRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  margin: -4px 0px;
`;

const StatusText = styled(Text)`
  flex: 1;
`;

const STATUS_HIT_SLOP = { top: 8, bottom: 8 };

/**
 * Linha de situação do rodapé: o efeito das escolhas do passo ("3 escolhidas
 * · 12 créditos", "2 de 7 disciplinas ficam sem turma"). Com `onPress`, a
 * linha inteira é um botão que abre o detalhe.
 */
export function FooterStatus({
  text,
  tone = 'muted',
  icon,
  onPress,
  actionLabel,
}: {
  text: string;
  tone?: 'muted' | 'bad' | 'good';
  icon?: IconName;
  onPress?: () => void;
  /** O que o toque faz, para o leitor de tela ("Ver as disciplinas escolhidas"). */
  actionLabel?: string;
}) {
  const theme = useTheme();
  const ink =
    tone === 'bad'
      ? theme.status.bad.ink
      : tone === 'good'
        ? theme.status.good.ink
        : theme.colors.inkMuted;
  return (
    <StatusRow
      disabled={!onPress}
      onPress={onPress}
      hitSlop={STATUS_HIT_SLOP}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={
        onPress && actionLabel ? `${text}. ${actionLabel}` : text
      }
      accessibilityLiveRegion="polite"
    >
      {icon ? (
        <Icon name={icon} size={theme.sizes.icon.sm} color={ink} />
      ) : null}
      <StatusText variant="meta" weight="medium" color={ink}>
        {text}
      </StatusText>
      {onPress ? (
        <Icon
          name="expand_less"
          size={theme.sizes.icon.lg}
          color={theme.colors.accent}
        />
      ) : null}
    </StatusRow>
  );
}
