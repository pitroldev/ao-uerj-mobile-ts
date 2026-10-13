import React from 'react';
// oxlint-disable-next-line no-restricted-imports -- a pasta Snackbar é a única porta para a lib
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

/** Texto do aviso para leitores de tela: título e detalhe. */
export function snackbarLabel(title?: string, detail?: string): string {
  return [title, detail].filter(Boolean).join('. ');
}

/**
 * Snackbar escuro do sistema (".snack"): ícone de status, título e detalhe,
 * canto cortado. Desenhado pelo `SnackbarHost` via `toastConfig`; dispare com
 * `snackbar.success/error/info(título, detalhe)`.
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
        accessibilityLabel={snackbarLabel(title, detail)}
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
 * Configuração do `<Toast config={toastConfig} />` do `SnackbarHost`, no
 * estilo do protótipo. Tipos: `success`, `error` e `info`.
 */
export const toastConfig: ToastConfig = {
  success: render('success'),
  error: render('error'),
  info: render('info'),
};
