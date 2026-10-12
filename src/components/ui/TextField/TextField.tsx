import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputInstance,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import styled, { useTheme, type DefaultTheme } from 'styled-components/native';

import { IconButton } from '../Button/IconButton';
import { Icon, type IconName } from '../Icon';
import { Text, typeStyle } from '../Text';

/** Props de cor/seleção comuns aos campos do sistema. */
export function inputColors(theme: DefaultTheme) {
  return {
    placeholderTextColor: theme.colors.inkMuted,
    selectionColor: theme.colors.selection,
    cursorColor: theme.colors.accent,
    selectionHandleColor: theme.colors.accent,
  } as const;
}

/** Tipografia do texto digitado (sem `lineHeight`, que corta o texto no Android). */
export function inputTextStyle(theme: DefaultTheme): TextStyle {
  const { fontFamily, fontSize, letterSpacing } = typeStyle(theme, 'body');
  return { fontFamily, fontSize, letterSpacing, color: theme.colors.ink };
}

type FocusEvt = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEvt = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  /** Rótulo acima do campo (13/18 medium). Também vira o rótulo acessível. */
  label?: string;
  leadingIcon?: IconName;
  /** Mostra o botão de limpar (×) quando há texto. */
  clearable?: boolean;
  /** Rótulo do botão de limpar. Padrão "Limpar". */
  clearLabel?: string;
  /** Chamado ao limpar. Padrão: `onChangeText('')`. */
  onClear?: () => void;
  /** Campo de senha com botão mostrar/ocultar. */
  secureToggle?: boolean;
  /** Mensagem de erro (ou `true` só para a borda vermelha). */
  error?: string | boolean;
  /** Texto de apoio abaixo do campo. */
  helper?: string;
  /** Elemento extra à direita, antes do limpar. */
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

type BoxProps = {
  $multiline: boolean;
  $ring: boolean;
  $invalid: boolean;
  $focused: boolean;
  $editable: boolean;
};

const Wrapper = styled.View``;

const Label = styled(Text)`
  margin-bottom: 6px;
`;

/** A borda engrossa no foco/erro; o padding compensa para o texto não pular. */
const Box = styled.View<BoxProps>`
  flex-direction: row;
  align-items: ${({ $multiline }) => ($multiline ? 'flex-start' : 'center')};
  gap: 8px;
  min-height: ${({ theme }) => theme.sizes.field}px;
  padding-left: ${({ $ring }) => ($ring ? 11 : 12)}px;
  padding-right: ${({ $multiline, $ring }) =>
    $multiline ? ($ring ? 11 : 12) : 0}px;
  border-width: ${({ theme, $ring }) =>
    $ring ? theme.borders.focus : theme.borders.hairline}px;
  border-color: ${({ theme, $invalid, $focused }) =>
    $invalid
      ? theme.status.bad.ink
      : $focused
        ? theme.colors.accent
        : theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $editable }) =>
    $editable ? theme.colors.surface : theme.colors.surfaceMuted};
`;

const LeadingIcon = styled.View<{ $multiline: boolean }>`
  ${({ $multiline }) => ($multiline ? 'margin-top: 13px;' : '')}
`;

/** Botão dentro do campo (".field .ib"): 48×46, raio 8, encostado no texto. */
const fieldButton = {
  marginLeft: -8,
  height: 46,
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
  borderBottomLeftRadius: 8,
  borderBottomRightRadius: 8,
} as const;

const Helper = styled(Text)`
  margin-top: 6px;
`;

const ErrorRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
`;

const Shrink = styled(Text)`
  flex-shrink: 1;
`;

/**
 * Campo de texto (".field"): borda de 1px com canto cortado, ícone opcional,
 * botão de limpar, mostrar senha e erro. `multiline` vira a área de texto.
 */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function (
    {
      label,
      leadingIcon,
      clearable = false,
      clearLabel = 'Limpar',
      onClear,
      secureToggle = false,
      error,
      helper,
      trailing,
      containerStyle,
      fieldStyle,
      inputStyle,
      multiline = false,
      value,
      onChangeText,
      onFocus,
      onBlur,
      editable = true,
      accessibilityLabel,
      secureTextEntry,
      ...rest
    },
    ref,
  ) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const invalid = Boolean(error);
    const showClear = clearable && Boolean(value) && editable;
    const hasTrailing = showClear || secureToggle || Boolean(trailing);

    const handleFocus = (e: FocusEvt) => {
      setFocused(true);
      onFocus?.(e);
    };
    const handleBlur = (e: BlurEvt) => {
      setFocused(false);
      onBlur?.(e);
    };
    const clear = () => (onClear ? onClear() : onChangeText?.(''));

    return (
      <Wrapper style={containerStyle}>
        {label ? (
          <Label variant="meta" weight="medium">
            {label}
          </Label>
        ) : null}
        <Box
          $multiline={multiline}
          $ring={focused || invalid}
          $invalid={invalid}
          $focused={focused}
          $editable={editable}
          style={fieldStyle}
        >
          {leadingIcon ? (
            <LeadingIcon $multiline={multiline}>
              <Icon
                name={leadingIcon}
                size={theme.sizes.icon.lg}
                color={theme.colors.inkMuted}
              />
            </LeadingIcon>
          ) : null}
          <RNTextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={editable}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            secureTextEntry={secureToggle ? !revealed : secureTextEntry}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: !editable }}
            {...inputColors(theme)}
            style={[
              styles.input,
              !hasTrailing && !multiline && styles.inputPadRight,
              multiline && styles.inputMultiline,
              inputTextStyle(theme),
              inputStyle,
            ]}
            {...rest}
          />
          {trailing}
          {showClear ? (
            <IconButton
              icon="close"
              iconSize={theme.sizes.icon.lg}
              accessibilityLabel={clearLabel}
              onPress={clear}
              style={fieldButton}
            />
          ) : null}
          {secureToggle ? (
            <IconButton
              icon={revealed ? 'visibility_off' : 'visibility'}
              iconSize={theme.sizes.icon.lg}
              accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
              selected={revealed}
              onPress={() => setRevealed(v => !v)}
              style={fieldButton}
            />
          ) : null}
        </Box>
        {typeof error === 'string' && error ? (
          <FieldError message={error} />
        ) : helper ? (
          <Helper variant="meta" tone="muted">
            {helper}
          </Helper>
        ) : null}
      </Wrapper>
    );
  },
);
TextField.displayName = 'TextField';

/** Mensagem de erro de campo (".err"): ícone + texto vermelho, anunciada. */
export function FieldError({
  message,
  style,
}: {
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <ErrorRow
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={style}
    >
      <Icon
        name="error"
        size={theme.sizes.icon.sm}
        color={theme.status.bad.ink}
      />
      <Shrink variant="meta" tone="bad">
        {message}
      </Shrink>
    </ErrorRow>
  );
}

export type SearchFieldProps = Omit<
  TextFieldProps,
  'leadingIcon' | 'clearable'
>;

/** Campo de busca: lupa, botão de limpar e tecla "pesquisar". */
export const SearchField = forwardRef<TextInputInstance, SearchFieldProps>(
  function (
    { clearLabel = 'Limpar busca', accessibilityLabel, placeholder, ...rest },
    ref,
  ) {
    return (
      <TextField
        ref={ref}
        leadingIcon="search"
        clearable
        clearLabel={clearLabel}
        returnKeyType="search"
        autoCorrect={false}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder ?? 'Pesquisar'}
        {...rest}
      />
    );
  },
);
SearchField.displayName = 'SearchField';

const styles = StyleSheet.create({
  // ref no TextInput exige o componente puro (o styled não repassa ref no React 19)
  input: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 0 },
  inputPadRight: { paddingRight: 12 },
  inputMultiline: { minHeight: 132 },
});

export default TextField;
