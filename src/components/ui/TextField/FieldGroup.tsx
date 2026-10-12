import React, {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputInstance,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { IconButton } from '../Button/IconButton';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { inputColors, inputTextStyle } from './TextField';

type FocusEvt = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEvt = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

type GroupState = { setFocused: (key: string | null) => void };

const GroupContext = createContext<GroupState>({
  setFocused: () => undefined,
});

export type FieldGroupProps = {
  children?: React.ReactNode;
  /** Borda vermelha no grupo inteiro. */
  invalid?: boolean;
  /**
   * Mensagem de erro do formulário (".form-err"), abaixo do grupo, com ícone,
   * anunciada para leitores de tela. A linha reserva altura mesmo vazia.
   */
  error?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** A borda engrossa no foco/erro; a margem negativa evita o salto do layout. */
const Group = styled.View<{
  $ring: boolean;
  $invalid: boolean;
  $focused: boolean;
}>`
  border-width: ${({ theme, $ring }) =>
    $ring ? theme.borders.focus : theme.borders.hairline}px;
  border-color: ${({ theme, $invalid, $focused }) =>
    $invalid
      ? theme.status.bad.ink
      : $focused
        ? theme.colors.accent
        : theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
  margin: ${({ $ring }) => ($ring ? -1 : 0)}px;
`;

const RowSlot = styled.View<{ $rule: boolean }>`
  ${({ theme, $rule }) =>
    $rule
      ? `border-top-width: ${theme.borders.hairline}px; border-top-color: ${theme.colors.rule};`
      : ''}
`;

const ErrorLine = styled.View`
  min-height: 20px;
  margin-top: 6px;
  margin-bottom: 12px;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const Shrink = styled(Text)`
  flex-shrink: 1;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: ${({ theme }) => theme.sizes.fieldGroupRow}px;
  padding: 0px 4px 0px 14px;
`;

const RowLabel = styled(Text)`
  width: 78px;
`;

const HIDDEN = { opacity: 0 } as const;

/**
 * Grupo de campos do login (".fgroup"): uma caixa com canto cortado, rótulo
 * na coluna da esquerda e um fio entre as linhas.
 */
export function FieldGroup({
  children,
  invalid = false,
  error,
  style,
}: FieldGroupProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState<string | null>(null);
  const isInvalid = invalid || Boolean(error);
  const value = useMemo(() => ({ setFocused }), []);
  const rows = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <GroupContext.Provider value={value}>
      <Group
        $ring={isInvalid || focused != null}
        $invalid={isInvalid}
        $focused={focused != null}
        style={style}
      >
        {rows.map((row, i) => (
          <RowSlot key={i} $rule={i > 0}>
            {row}
          </RowSlot>
        ))}
      </Group>
      <ErrorLine accessibilityRole="alert" accessibilityLiveRegion="polite">
        {error ? (
          <>
            <Icon
              name="error"
              size={theme.sizes.icon.md}
              color={theme.status.bad.ink}
            />
            <Shrink variant="meta" weight="medium" tone="bad">
              {error}
            </Shrink>
          </>
        ) : null}
      </ErrorLine>
    </GroupContext.Provider>
  );
}

export type FieldGroupRowProps = Omit<TextInputProps, 'style'> & {
  icon: IconName;
  /** Rótulo da coluna esquerda ("Matrícula", "Senha"). */
  label: string;
  clearable?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  /** Senha com botão mostrar/ocultar. */
  secureToggle?: boolean;
};

/** Linha do `FieldGroup`: ícone, rótulo à esquerda, campo e ação. */
export const FieldGroupRow = forwardRef<TextInputInstance, FieldGroupRowProps>(
  function (
    {
      icon,
      label,
      clearable = false,
      clearLabel,
      onClear,
      secureToggle = false,
      value,
      onChangeText,
      onFocus,
      onBlur,
      secureTextEntry,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) {
    const theme = useTheme();
    const group = useContext(GroupContext);
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const tint = focused ? theme.colors.accent : undefined;

    const handleFocus = (e: FocusEvt) => {
      setFocused(true);
      group.setFocused(label);
      onFocus?.(e);
    };
    const handleBlur = (e: BlurEvt) => {
      setFocused(false);
      group.setFocused(null);
      onBlur?.(e);
    };

    return (
      <Row>
        <Icon
          name={icon}
          size={theme.sizes.icon.lg}
          color={tint ?? theme.colors.inkMuted}
        />
        <RowLabel
          weight="medium"
          color={tint}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {label}
        </RowLabel>
        <RNTextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureToggle ? !revealed : secureTextEntry}
          accessibilityLabel={accessibilityLabel ?? label}
          {...inputColors(theme)}
          style={[styles.input, inputTextStyle(theme)]}
          {...rest}
        />
        {clearable ? (
          <IconButton
            icon="close"
            iconSize={theme.sizes.icon.lg}
            accessibilityLabel={clearLabel ?? `Limpar ${label.toLowerCase()}`}
            onPress={() => (onClear ? onClear() : onChangeText?.(''))}
            // mantém o espaço para o texto não pular quando o botão aparece
            style={value ? undefined : HIDDEN}
            disabled={!value}
            importantForAccessibility={value ? 'auto' : 'no-hide-descendants'}
          />
        ) : null}
        {secureToggle ? (
          <IconButton
            icon={revealed ? 'visibility_off' : 'visibility'}
            iconSize={theme.sizes.icon.lg}
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            selected={revealed}
            onPress={() => setRevealed(v => !v)}
          />
        ) : null}
      </Row>
    );
  },
);
FieldGroupRow.displayName = 'FieldGroupRow';

const styles = StyleSheet.create({
  // ref no TextInput exige o componente puro (o styled não repassa ref no React 19)
  input: { flex: 1, minWidth: 0, minHeight: 54, padding: 0 },
});

export default FieldGroup;
