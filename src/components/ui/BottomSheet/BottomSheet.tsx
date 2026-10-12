import React from 'react';
import {
  Dimensions,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { IconButton } from '../Button/IconButton';
import { Text } from '../Text';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useReducedMotion } from '../hooks/useReducedMotion';

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

const MODAL_STYLE = { margin: 0, justifyContent: 'flex-end' } as const;

/**
 * No Android 15+ (API 35, alvo 36) a atividade é sempre de ponta a ponta: o
 * conteúdo passa por baixo da barra de gestos/navegação. A janela da folha
 * precisa ser também, senão a faixa da barra mostra a tela de baixo sem véu.
 * Nesse modo o sistema não redimensiona a janela com o teclado, e a folha
 * sobe sozinha (`useKeyboardHeight`). Abaixo do Android 15 a barra é opaca e
 * a atividade não passa por baixo dela: só a barra de status fica translúcida
 * (o véu escurece a barra de status em todas as versões).
 */
const EDGE_TO_EDGE =
  Platform.OS === 'android' && Number(Platform.Version) >= 35;

/**
 * O react-native-modal 14 repassa props extras ao `Modal` do RN 0.83, mas
 * ainda não tipa `navigationBarTranslucent`.
 */
const NAV_BAR_PROPS: object = { navigationBarTranslucent: EDGE_TO_EDGE };

/** Folga entre o topo da folha e a barra de status quando o teclado a empurra. */
const TOP_GAP = 8;

const Sheet = styled.View<{ $maxHeight: number; $lift: number }>`
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  margin-bottom: ${({ $lift }) => $lift}px;
  background-color: ${({ theme }) => theme.colors.sheet};
  border-top-left-radius: ${({ theme }) => theme.radii.sheet}px;
  border-top-right-radius: ${({ theme }) => theme.radii.sheet}px;
`;

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
 * Folha inferior (".sheet") sobre react-native-modal: alça, título, fechar,
 * corpo rolável e rodapé fixo. Substitui os modais centrais.
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
  const screenHeight = Math.max(Dimensions.get('screen').height, height);
  const keyboard = useKeyboardHeight(EDGE_TO_EDGE && visible);
  // o teclado do Android já desconta a barra de navegação: soma de volta
  const lift = keyboard > 0 ? keyboard + insets.bottom : 0;
  const bottomInset = lift > 0 ? 0 : insets.bottom;
  const bottomPad = Math.max(footer ? 28 : 20, bottomInset + 12);
  const maxHeight = Math.min(
    height * theme.layout.sheetMaxHeight,
    screenHeight - lift - insets.top - TOP_GAP,
  );
  const motion = (ms: number) => (reduced ? 1 : ms);

  const body = (
    <Body $bottom={footer ? 20 : bottomPad} style={bodyStyle}>
      {children}
    </Body>
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      onModalHide={onClosed}
      swipeDirection={swipeToClose ? 'down' : undefined}
      propagateSwipe
      avoidKeyboard
      statusBarTranslucent
      {...NAV_BAR_PROPS}
      deviceHeight={screenHeight}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropColor={theme.colors.scrim}
      backdropOpacity={1}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={motion(theme.motion.slow)}
      animationOutTiming={motion(theme.motion.base)}
      backdropTransitionInTiming={motion(220)}
      backdropTransitionOutTiming={motion(220)}
      style={MODAL_STYLE}
    >
      <Sheet
        testID={testID}
        $maxHeight={maxHeight}
        $lift={lift}
        accessibilityViewIsModal
        style={theme.shadows.sheet}
      >
        <Handle
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Head>
          <Title variant="titleS" accessibilityRole="header">
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
        {scrollable ? (
          <Scroll bounces={false} keyboardShouldPersistTaps="handled">
            {body}
          </Scroll>
        ) : (
          <Static>{body}</Static>
        )}
        {footer ? (
          <Foot $bottom={bottomPad}>
            {React.Children.toArray(footer).map((child, i) => (
              <FootItem key={i}>{child}</FootItem>
            ))}
          </Foot>
        ) : null}
      </Sheet>
    </Modal>
  );
}

export default BottomSheet;
