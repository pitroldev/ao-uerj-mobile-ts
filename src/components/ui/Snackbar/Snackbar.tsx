import React from 'react';
import type {
  ToastConfig,
  ToastConfigParams,
} from 'react-native-toast-message';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type SnackbarKind = 'success' | 'error' | 'info';

export type SnackbarProps = {
  kind?: SnackbarKind;
  /** Título (14/20 semibold). */
  title?: string;
  /** Detalhe (13/18). */
  detail?: string;
  onPress?: () => void;
};

const ICONS: Record<SnackbarKind, IconName> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const Outer = styled.View`
  width: 100%;
  padding: 0px 12px;
`;

const Bar = styled.Pressable`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.snackbar};
`;

const Body = styled.View`
  flex: 1;
  min-width: 0px;
`;

const Detail = styled(Text)`
  opacity: 0.85;
`;

/**
 * Snackbar escuro do sistema (".snack"): ícone de status, título e detalhe,
 * canto cortado. Renderizado pelo react-native-toast-message via
 * `toastConfig`; dispare com `Toast.show({ type, text1, text2 })`.
 */
export function Snackbar({
  kind = 'info',
  title,
  detail,
  onPress,
}: SnackbarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const iconColor =
    kind === 'success'
      ? c.snackbarSuccess
      : kind === 'error'
      ? c.snackbarError
      : c.onSnackbar;
  return (
    <Outer>
      <Bar
        onPress={onPress}
        accessibilityRole={kind === 'error' ? 'alert' : 'text'}
        accessibilityLiveRegion="polite"
        accessibilityLabel={[title, detail].filter(Boolean).join('. ')}
        accessibilityHint={onPress ? 'Toque para dispensar' : undefined}
        style={theme.shadows.snackbar}
      >
        <Icon name={ICONS[kind]} size={theme.sizes.icon.lg} color={iconColor} />
        <Body>
          {title ? (
            <Text weight="semibold" color={c.onSnackbar}>
              {title}
            </Text>
          ) : null}
          {detail ? (
            <Detail variant="meta" color={c.onSnackbar}>
              {detail}
            </Detail>
          ) : null}
        </Body>
      </Bar>
    </Outer>
  );
}

function render(kind: SnackbarKind) {
  return function SnackbarToast({
    text1,
    text2,
    hide,
    onPress,
  }: ToastConfigParams<unknown>) {
    return (
      <Snackbar
        kind={kind}
        title={text1}
        detail={text2}
        onPress={() => {
          onPress?.();
          hide();
        }}
      />
    );
  };
}

/**
 * Configuração do `<Toast config={toastConfig} />` no estilo do protótipo.
 * Tipos: `success`, `error` e `info` (os mesmos usados hoje no app).
 */
export const toastConfig: ToastConfig = {
  success: render('success'),
  error: render('error'),
  info: render('info'),
};

export default Snackbar;
