import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon } from '../Icon';
import { TextField } from './TextField';

export type TimeFieldProps = {
  label: string;
  /** Minutos desde 00:00. */
  value: number;
  /** Chamado com um horário válido, em minutos desde 00:00. */
  onChange: (minutes: number) => void;
  helper?: string;
  /** Rótulo para leitores de tela. Padrão: o `label`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** "08:00", com dois dígitos na hora: o campo mostra o que se digita. */
export function formatTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Lê "14:20", "1420", "820" (8:20) e "8" (8:00). `null` fora de 00:00–23:59
 * ou sem dígitos.
 */
export function parseTime(text: string): number | null {
  let hours: string;
  let minutes: string;
  if (text.includes(':')) {
    [hours, minutes = ''] = text.split(':');
  } else {
    const digits = text.replace(/\D/g, '');
    // "8" e "14" são horas cheias; "820" é 8:20 e "1420", 14:20
    hours = digits.length > 2 ? digits.slice(0, -2) : digits;
    minutes = digits.length > 2 ? digits.slice(-2) : '';
  }
  hours = hours.replace(/\D/g, '');
  minutes = minutes.replace(/\D/g, '');
  if (!hours || hours.length > 2 || minutes.length > 2) return null;
  const h = Number(hours);
  const m = minutes ? Number(minutes) : 0;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

const INVALID = 'Use um horário entre 00:00 e 23:59.';

/**
 * Campo de horário (24 h) no teclado numérico. O que já forma um horário vale
 * na hora ("8" é 8:00, "930" é 9:30), para que um "Salvar" tocado com o campo
 * ainda em foco leve o que foi digitado; "1420" vira "14:20" no quarto dígito.
 * Ao sair, o campo mostra o horário que valeu; um impossível volta ao anterior.
 */
export function TimeField({
  label,
  value,
  onChange,
  helper,
  accessibilityLabel,
  style,
}: TimeFieldProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const text = draft ?? formatTime(value);

  const change = (next: string) => {
    const typed = next.replace(/[^\d:]/g, '').slice(0, 5);
    const digits = typed.replace(/\D/g, '').slice(0, 4);
    const minutes = parseTime(digits.length === 4 ? digits : typed);
    if (minutes !== null) onChange(minutes);
    if (digits.length === 4) {
      setDraft(
        minutes === null
          ? `${digits.slice(0, 2)}:${digits.slice(2)}`
          : formatTime(minutes),
      );
      setInvalid(minutes === null);
      return;
    }
    setDraft(typed);
    setInvalid(false);
  };

  // o horário já valeu enquanto se digitava: aqui o campo só volta a mostrá-lo
  const finish = () => {
    setDraft(null);
    setInvalid(false);
  };

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={change}
      onBlur={finish}
      onSubmitEditing={finish}
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={5}
      selectTextOnFocus
      error={invalid ? INVALID : undefined}
      helper={helper}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint="Horário de 24 horas, como 14:20"
      containerStyle={style}
      trailing={
        <Clock>
          <Icon
            name="schedule"
            size={theme.sizes.icon.lg}
            color={theme.colors.inkMuted}
          />
        </Clock>
      }
    />
  );
}

/** O relógio no lugar do botão de limpar, com o mesmo respiro da borda. */
const Clock = styled.View`
  margin-right: 12px;
`;
