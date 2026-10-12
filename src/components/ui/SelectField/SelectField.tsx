import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Icon, type IconName } from '../Icon';
import { List } from '../ListRow/List';
import { ListRow } from '../ListRow/ListRow';
import { Radio } from '../Selection/Radio';
import { Text } from '../Text';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** Texto à direita ("CR 7,77", "Em curso"). */
  aside?: string;
  /** Linha de apoio abaixo do rótulo. */
  description?: string;
};

export type OptionListProps<T extends string = string> = {
  options: SelectOption<T>[];
  value: T | null | undefined;
  onSelect: (value: T) => void;
  /** Nome do grupo para leitores de tela. */
  accessibilityLabel?: string;
};

/** Lista de opções com rádio (corpo das folhas de seleção). */
export function OptionList<T extends string = string>({
  options,
  value,
  onSelect,
  accessibilityLabel,
}: OptionListProps<T>) {
  return (
    <List
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(opt => {
        const checked = opt.value === value;
        return (
          <ListRow
            key={opt.value}
            title={opt.label}
            titleWeight="regular"
            subtitle={opt.description}
            aside={opt.aside}
            leading={<Radio selected={checked} />}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
          />
        );
      })}
    </List>
  );
}

export type SelectFieldProps<T extends string = string> = {
  /** Rótulo pequeno acima do valor ("Período", "Docente"). */
  label: string;
  /** Texto exibido. Com `options`, padrão é o rótulo da opção escolhida. */
  valueLabel?: string;
  placeholder?: string;
  icon?: IconName;
  /** Texto à direita, antes da seta ("CR atual 7,77"). */
  aside?: string;
  disabled?: boolean;
  /** Modo livre: você abre a sua própria folha/tela. */
  onPress?: () => void;
  /**
   * Modo com opções: o campo abre uma `BottomSheet` com `OptionList` e chama
   * `onChange` ao escolher.
   */
  options?: SelectOption<T>[];
  value?: T | null;
  onChange?: (value: T) => void;
  /** Título da folha. Padrão `label`. */
  sheetTitle?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Field = styled.Pressable<{ $disabled: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: ${({ theme }) => theme.sizes.select}px;
  padding: 4px 8px 4px 12px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.surfaceMuted : theme.colors.surface};
`;

const Main = styled.View`
  flex: 1;
  min-width: 0px;
`;

const Value = styled(Text)`
  line-height: 20px;
`;

/**
 * Seletor (".select"): parece um campo, abre uma folha inferior com as
 * opções. Ex.: "Período ▾" em Disciplinas Realizadas.
 */
export function SelectField<T extends string = string>({
  label,
  valueLabel,
  placeholder,
  icon,
  aside,
  disabled = false,
  onPress,
  options,
  value,
  onChange,
  sheetTitle,
  accessibilityLabel,
  style,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const selected = options?.find(o => o.value === value);
  const shown = valueLabel ?? selected?.label ?? placeholder ?? '';
  const shownAside = aside ?? selected?.aside;

  return (
    <>
      <Field
        $disabled={disabled}
        onPress={options ? () => setOpen(true) : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          `${label}: ${shown}${shownAside ? `, ${shownAside}` : ''}. Trocar`
        }
        accessibilityState={{ disabled, expanded: open }}
        style={({ pressed }) => [pressed && { borderColor: c.inkMuted }, style]}
      >
        {icon ? (
          <Icon name={icon} size={theme.sizes.icon.lg} color={c.inkMuted} />
        ) : null}
        <Main>
          <Text variant="caption" weight="regular" tone="muted">
            {label}
          </Text>
          <Value
            variant="body"
            tone={valueLabel || selected ? 'ink' : 'muted'}
            numberOfLines={1}
          >
            {shown}
          </Value>
        </Main>
        {shownAside ? (
          <Text tone="muted" tabular numberOfLines={1}>
            {shownAside}
          </Text>
        ) : null}
        <Icon
          name="expand_more"
          size={theme.sizes.icon.lg}
          color={c.inkMuted}
        />
      </Field>
      {options ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={sheetTitle ?? label}
        >
          <OptionList
            options={options}
            value={value}
            accessibilityLabel={sheetTitle ?? label}
            onSelect={v => {
              setOpen(false);
              onChange?.(v);
            }}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}

export default SelectField;
