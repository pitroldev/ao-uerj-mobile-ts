import React, {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  useWindowDimensions,
  type GestureResponderEvent,
  type ModalProps,
  type StyleProp,
  type TextInstance,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { ThemeProvider, useTheme } from 'styled-components/native';

import { sheetTheme } from '@root/themes';
import { IconButton } from '../Button/IconButton';
import { SnackbarHost } from '../Snackbar/SnackbarHost';
import { Text } from '../Text';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { trackOpenSheet } from './openSheets';

export type BottomSheetProps = {
  visible: boolean;
  /** Fecha pelo X, pelo véu, pelo botão voltar do Android e pelo gesto. */
  onClose: () => void;
  title: string;
  /** Texto curto à direita do título ("6 ativas", "Passo 1 de 2"). */
  meta?: string;
  children?: React.ReactNode;
  /**
   * Barra fixa inferior com fio. Cada filho ocupa a mesma largura
   * (".sheet-foot .btn{flex:1}"): passe os `Button`s direto.
   */
  footer?: React.ReactNode;
  /** Corpo rolável (padrão). Desligue para listas virtualizadas próprias. */
  scrollable?: boolean;
  /** Arrastar para baixo fecha. Padrão `true`. */
  swipeToClose?: boolean;
  /** Rótulo do botão fechar. Padrão "Fechar". */
  closeLabel?: string;
  /** Chamado depois que a folha terminou de fechar. */
  onClosed?: () => void;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Folga entre o topo da folha e a barra de status quando o teclado a empurra. */
const TOP_GAP = 8;
/** Arrasto mínimo, para baixo, antes de a folha tomar o toque de um filho. */
const DRAG_SLOP = 8;
/** Soltar depois de arrastar isso (dp) ou mais rápido que isso (dp/ms) fecha. */
const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 1;

const ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'landscape',
];

const Root = styled.View`
  flex: 1;
`;

const Scrim = styled(Animated.View)`
  position: absolute;
  top: 0px;
  right: 0px;
  bottom: 0px;
  left: 0px;
  background-color: ${({ theme }) => theme.colors.scrim};
`;

/** A folha fica no pé da tela e encolhe quando o teclado empurra o fundo. */
const Avoider = styled(KeyboardAvoidingView)<{ $top: number }>`
  flex: 1;
  justify-content: flex-end;
  padding-top: ${({ $top }) => $top}px;
`;

const Sheet = styled(Animated.View)<{ $maxHeight: number }>`
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  flex-shrink: 1;
  background-color: ${({ theme }) => theme.colors.sheet};
  border-top-left-radius: ${({ theme }) => theme.radii.sheet}px;
  border-top-right-radius: ${({ theme }) => theme.radii.sheet}px;
`;

/** Conteúdo da folha: alça e título, corpo e rodapé. */
const Grip = styled.View`
  flex-shrink: 1;
`;

/**
 * Alça e título. Eles, o corpo e o rodapé ficam com o toque que nenhum filho
 * quis: sem isso ele vai para o `Modal`, que segura os toques soltos, e o
 * arrasto nunca chega à folha. Nenhum ancestral do corpo rolável pode ficar
 * com o toque: no Android, a view que tem o toque intercepta os filhos, e a
 * rolagem só andaria começando num botão.
 */
const Top = styled.View``;

const Handle = styled.View`
  width: 32px;
  height: 4px;
  border-radius: 2px;
  margin-top: 10px;
  align-self: center;
  background-color: ${({ theme }) => theme.colors.ruleStrong};
`;

const Head = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 4px ${({ theme }) => theme.layout.gutter}px;
`;

const Title = styled(Text)`
  flex: 1;
`;

const Scroll = styled.ScrollView`
  flex-grow: 0;
  flex-shrink: 1;
`;

const Static = styled.View`
  flex-shrink: 1;
`;

const Body = styled.View<{ $bottom: number }>`
  padding: 4px ${({ theme }) => theme.layout.gutter}px
    ${({ $bottom }) => $bottom}px;
`;

const Foot = styled.View<{ $bottom: number }>`
  flex-direction: row;
  gap: 12px;
  padding: 12px ${({ theme }) => theme.layout.gutter}px
    ${({ $bottom }) => $bottom}px;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

const FootItem = styled.View`
  flex: 1;
`;

/**
 * Folha inferior (".sheet") sobre o `Modal` do React Native: alça, título,
 * fechar, corpo rolável e rodapé fixo. Substitui os modais centrais.
 *
 * A janela da folha é de ponta a ponta como a do app: o véu cobre as barras
 * do sistema e o rodapé fica acima da área segura inferior. Com o teclado
 * aberto, a folha sobe junto (`KeyboardAvoidingView` do
 * react-native-keyboard-controller) e encolhe se faltar altura. A folha
 * acompanha o dedo; o arrasto vale onde nenhum filho rola (alça, título,
 * rodapé, corpo curto).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  meta,
  children,
  footer,
  scrollable = true,
  swipeToClose = true,
  closeLabel = 'Fechar',
  onClosed,
  bodyStyle,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const titleRef = useRef<TextInstance>(null);

  // o Modal continua montado enquanto a folha desce
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  useEffect(() => (mounted ? trackOpenSheet() : undefined), [mounted]);

  /** Deslocamento da folha: `height` = fora da tela, 0 = aberta. */
  const offset = useAnimatedValue(height);
  const sheetHeight = useAnimatedValue(height);
  // o véu clareia conforme a folha desce (entrada, saída e arrasto)
  const scrimOpacity = useMemo(
    () =>
      Animated.divide(offset, sheetHeight).interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [offset, sheetHeight],
  );
  const easing = Easing.bezier(...theme.motion.easing);

  const finishClosing = useEffectEvent(() => {
    setMounted(false);
    onClosed?.();
  });

  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(offset, {
      toValue: visible ? 0 : height,
      duration: reduced ? 0 : visible ? theme.motion.slow : theme.motion.base,
      easing,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) finishClosing();
    });
    return () => animation.stop();
  }, [visible, mounted]);

  /** Início do toque e velocidade do arrasto (dp/ms). */
  const drag = useRef({ x: 0, y: 0, lastY: 0, lastTime: 0, velocity: 0 });

  /** Devolve a folha ao lugar depois de um arrasto que não a fechou. */
  const settle = () => {
    // fechando: a animação de saída já cuida do deslocamento
    if (!visible) return;
    Animated.timing(offset, {
      toValue: 0,
      duration: reduced ? 0 : theme.motion.base,
      easing,
      useNativeDriver: true,
    }).start();
  };

  // Sistema de responder do RN: toques e rolagem ficam com os filhos, e a
  // folha só toma o arrasto vertical para baixo que nenhum deles usou.
  const gesture = {
    onTouchStart: (event: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = event.nativeEvent;
      drag.current = {
        x: pageX,
        y: pageY,
        lastY: pageY,
        lastTime: timestamp,
        velocity: 0,
      };
    },
    onMoveShouldSetResponder: (event: GestureResponderEvent) => {
      const dy = event.nativeEvent.pageY - drag.current.y;
      const dx = event.nativeEvent.pageX - drag.current.x;
      return visible && swipeToClose && dy > DRAG_SLOP && dy > Math.abs(dx);
    },
    onResponderGrant: () => offset.stopAnimation(),
    onResponderMove: (event: GestureResponderEvent) => {
      const { pageY, timestamp } = event.nativeEvent;
      const state = drag.current;
      if (timestamp > state.lastTime) {
        state.velocity = (pageY - state.lastY) / (timestamp - state.lastTime);
      }
      state.lastY = pageY;
      state.lastTime = timestamp;
      if (visible) offset.setValue(Math.max(0, pageY - state.y));
    },
    onResponderRelease: (event: GestureResponderEvent) => {
      const dy = event.nativeEvent.pageY - drag.current.y;
      if (dy > CLOSE_DISTANCE || drag.current.velocity > CLOSE_VELOCITY) {
        onClose();
      }
      // se a folha fechar, a animação de saída substitui esta
      settle();
    },
    onResponderTerminate: settle,
  };

  const focusTitle = () => {
    if (titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  };

  if (!mounted) return null;

  const bottomPad = Math.max(footer ? 28 : 20, insets.bottom + 12);
  const claim = () => visible && swipeToClose;
  const body = (
    <Body
      $bottom={footer ? 20 : bottomPad}
      style={bodyStyle}
      onStartShouldSetResponder={claim}
    >
      {children}
    </Body>
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ORIENTATIONS}
      onRequestClose={onClose}
      onShow={focusTitle}
    >
      {/* a folha já é elevada: o que fica nela sobe um degrau (no escuro) */}
      <ThemeProvider theme={sheetTheme(theme)}>
        <Root>
          <Scrim style={{ opacity: scrimOpacity }}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar folha"
            />
          </Scrim>
          <Avoider
            behavior="padding"
            // a área segura inferior fica sob o teclado: o rodapé já a reserva
            keyboardVerticalOffset={-insets.bottom}
            $top={insets.top + TOP_GAP}
            pointerEvents="box-none"
          >
            <Sheet
              testID={testID}
              $maxHeight={height * theme.layout.sheetMaxHeight}
              accessibilityViewIsModal
              onAccessibilityEscape={onClose}
              onLayout={event =>
                sheetHeight.setValue(
                  Math.max(1, event.nativeEvent.layout.height),
                )
              }
              style={[
                theme.shadows.sheet,
                { transform: [{ translateY: offset }] },
              ]}
              {...gesture}
            >
              <Grip>
                <Top onStartShouldSetResponder={claim}>
                  <Handle
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <Head>
                    <Title
                      ref={titleRef}
                      variant="titleS"
                      accessibilityRole="header"
                    >
                      {title}
                    </Title>
                    {meta ? (
                      <Text variant="meta" tone="muted" numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : null}
                    <IconButton
                      icon="close"
                      color={theme.colors.ink}
                      accessibilityLabel={closeLabel}
                      onPress={onClose}
                    />
                  </Head>
                </Top>
                {scrollable ? (
                  <Scroll bounces={false} keyboardShouldPersistTaps="handled">
                    {body}
                  </Scroll>
                ) : (
                  <Static>{body}</Static>
                )}
                {footer ? (
                  <Foot $bottom={bottomPad} onStartShouldSetResponder={claim}>
                    {React.Children.toArray(footer).map((child, i) => (
                      <FootItem key={i}>{child}</FootItem>
                    ))}
                  </Foot>
                ) : null}
              </Grip>
            </Sheet>
          </Avoider>
          {/* avisos por cima da folha; ao fechar, o da raiz assume */}
          {visible ? <SnackbarHost /> : null}
        </Root>
      </ThemeProvider>
    </Modal>
  );
}
