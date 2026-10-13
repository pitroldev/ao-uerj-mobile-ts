import React from 'react';

import { BottomSheet, OptionList, type SelectOption } from '@components/ui';
import type { ThemePreference } from '../domain/themePreference';
import { useThemePreference } from './useThemePreference';

export const THEME_PREFERENCE_LABEL: Record<ThemePreference, string> = {
  system: 'Padrão do sistema',
  light: 'Claro',
  dark: 'Escuro',
};

const OPTIONS: SelectOption<ThemePreference>[] = [
  {
    value: 'system',
    label: THEME_PREFERENCE_LABEL.system,
    description: 'Acompanha o modo claro ou escuro do aparelho',
  },
  { value: 'light', label: THEME_PREFERENCE_LABEL.light },
  { value: 'dark', label: THEME_PREFERENCE_LABEL.dark },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Folha "Tema": padrão do sistema, claro ou escuro. Escolher aplica e fecha. */
export function ThemePreferenceSheet({ visible, onClose }: Props) {
  const { preference, choose } = useThemePreference();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tema">
      <OptionList
        options={OPTIONS}
        value={preference}
        accessibilityLabel="Tema"
        onSelect={value => {
          onClose();
          void choose(value);
        }}
      />
    </BottomSheet>
  );
}
