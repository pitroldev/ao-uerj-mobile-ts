import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Text } from '@components/ui';

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
