import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { LoadingBar, useSheetOpen } from '@components/ui';

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
  background-color: ${({ theme }) => theme.colors.background};
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
 * O painel acompanha o teclado dos campos dele, não o de uma folha: a folha
 * sobe sozinha e, se o painel encolhesse por trás dela, ao fechar a folha
 * sobraria um vão em branco enquanto o teclado desce.
 */
function useAvoidKeyboard(): boolean {
  const sheetOpen = useSheetOpen();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  // o teclado que abriu com uma folha na tela é dela até fechar
  const [sheetKeyboard, setSheetKeyboard] = useState(false);
  if (sheetOpen && keyboardVisible && !sheetKeyboard) setSheetKeyboard(true);
  if (!keyboardVisible && sheetKeyboard) setSheetKeyboard(false);
  return !sheetOpen && !sheetKeyboard;
}

/**
 * A janela é de ponta a ponta e não encolhe com o teclado: o painel, que vai
 * até o pé da tela, encolhe por conta própria, acompanhando a animação dele,
 * e assim o rodapé fixo e o fim da rolagem ficam acima do teclado. A área
 * segura inferior, que rodapé e conteúdo já reservam, fica sob o teclado.
 *
 * Lê a altura do teclado do `KeyboardProvider`, e não a de cada instância
 * (como o `KeyboardAvoidingView` da lib): um painel montado enquanto o
 * teclado desce (passo seguinte do gerador, detalhe da pesquisa) perdia o fim
 * da animação e ficava com um vão em branco preso no pé.
 */
function useKeyboardInsetStyle() {
  const insets = useSafeAreaInsets();
  const avoid = useAvoidKeyboard();
  const { height } = useReanimatedKeyboardAnimation();
  const safeBottom = insets.bottom;
  return useAnimatedStyle(() => {
    'worklet';
    return {
      paddingBottom: avoid ? Math.max(0, -height.value - safeBottom) : 0,
    };
  });
}

/**
 * Painel das telas (assinatura do app): canto superior esquerdo de
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
  const keyboardInset = useKeyboardInsetStyle();

  return (
    <Panel style={style} testID={testID}>
      <Reanimated.View
        style={[styles.keyboardArea, keyboardInset]}
        testID={testID ? `${testID}-keyboard-area` : undefined}
      >
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
      </Reanimated.View>
      {updating ? (
        <UpdatingSlot pointerEvents="none">
          <LoadingBar accessibilityLabel="Atualizando dados…" />
        </UpdatingSlot>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  keyboardArea: { flex: 1 },
  scroll: { flex: 1 },
});
