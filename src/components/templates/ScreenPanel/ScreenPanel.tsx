import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { LoadingBar } from '@components/ui';

export type ScreenPanelProps = {
  children?: React.ReactNode;
  /**
   * Conteúdo rolável (padrão). Com `false` o painel vira um contêiner fixo:
   * use quando a tela tem a sua própria `FlatList` (aplique
   * `usePanelContentStyle()` no `contentContainerStyle` dela).
   */
  scroll?: boolean;
  /** Puxar para atualizar (só com `scroll`). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Topo fixo que não rola, com fio inferior: trilho de passos do gerador,
   * nome da turma na conversa do mural.
   */
  header?: React.ReactNode;
  headerStyle?: StyleProp<ViewStyle>;
  /**
   * Rodapé fixo com fio superior (Anterior/Próximo, compositor do mural).
   * Cada filho ocupa a mesma largura.
   */
  footer?: React.ReactNode;
  /** Barra fina "atualizando" presa ao topo do painel. */
  updating?: boolean;
  /** Tira o padding padrão (32 / 20 / 40) do conteúdo. */
  padded?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.Ref<ScrollViewInstance>;
  /** Props extras do ScrollView (onScroll, keyboardShouldPersistTaps…). */
  scrollProps?: Omit<
    ScrollViewProps,
    'children' | 'contentContainerStyle' | 'refreshControl'
  >;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const Panel = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.surface};
  border-top-left-radius: ${({ theme }) => theme.layout.panelRadius}px;
  overflow: hidden;
`;

const Top = styled.View`
  padding-top: 18px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const Fixed = styled.View`
  flex: 1;
`;

const Foot = styled.View<{ $bottom: number }>`
  flex-direction: row;
  gap: 12px;
  padding: 12px ${({ theme }) => theme.layout.gutter}px
    ${({ $bottom }) => $bottom}px;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const FootItem = styled.View`
  flex: 1;
`;

const UpdatingSlot = styled.View`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  z-index: 2;
`;

/**
 * Estilo do conteúdo do painel: 32 no topo (abaixo da curva de 48), 20 nas
 * laterais e 40 no fim, mais a área segura inferior. Use em `FlatList`.
 */
export function usePanelContentStyle(): ViewStyle {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return {
    paddingTop: theme.layout.panelPaddingTop,
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.layout.panelPaddingBottom + insets.bottom,
  };
}

/**
 * Painel claro das telas (assinatura do app): canto superior esquerdo de
 * 48dp sobre o azul, conteúdo rolável com margens do sistema, puxar para
 * atualizar, topo e rodapé fixos opcionais, área segura respeitada.
 */
export function ScreenPanel({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  header,
  headerStyle,
  footer,
  updating = false,
  padded = true,
  contentContainerStyle,
  scrollRef,
  scrollProps,
  style,
  testID,
}: ScreenPanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const content = usePanelContentStyle();
  const bottom = Math.max(16, insets.bottom + 12);

  return (
    <Panel style={style} testID={testID}>
      {header ? <Top style={headerStyle}>{header}</Top> : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            padded ? content : null,
            // com rodapé fixo, o fim da rolagem não precisa da área segura
            padded && footer
              ? { paddingBottom: theme.layout.panelPaddingBottom }
              : null,
            contentContainerStyle,
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.accent]}
                tintColor={theme.colors.accent}
                progressBackgroundColor={theme.colors.surface}
              />
            ) : undefined
          }
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <Fixed>{children}</Fixed>
      )}
      {footer ? (
        <Foot $bottom={bottom}>
          {React.Children.toArray(footer).map((child, i) => (
            <FootItem key={i}>{child}</FootItem>
          ))}
        </Foot>
      ) : null}
      {updating ? (
        <UpdatingSlot pointerEvents="none">
          <LoadingBar accessibilityLabel="Atualizando dados…" />
        </UpdatingSlot>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
});

export default ScreenPanel;
