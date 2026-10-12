import type { DefaultTheme } from 'styled-components/native';
import type { ToneColors } from '@root/themes/types';

/**
 * Tons de significado aceitos pelas primitivas de status (StatusLabel, Tag,
 * GradeCell, ProgressBar, Notice…). `accent` é sinônimo de `info`.
 */
export type UiTone =
  | 'good'
  | 'warn'
  | 'bad'
  | 'neutral'
  | 'info'
  | 'accent'
  | 'morning'
  | 'afternoon'
  | 'night';

export function toneColors(theme: DefaultTheme, tone: UiTone): ToneColors {
  switch (tone) {
    case 'morning':
    case 'afternoon':
    case 'night':
      return theme.shift[tone];
    case 'accent':
      return theme.status.info;
    default:
      return theme.status[tone];
  }
}

/** Rótulo padrão de cada saúde ("Bom", "Atenção", "Crítico"). */
export const HEALTH_LABEL = {
  good: 'Bom',
  warn: 'Atenção',
  bad: 'Crítico',
  neutral: 'Sem dado',
} as const;

/**
 * Converte a saúde calculada por `numberToColor` / `getVacancieHealth`
 * ('GOOD' | 'BAD' | 'CRITICAL'; qualquer outro valor, como 'CANCELED',
 * vira `neutral`) no tom do design system.
 */
export function healthTone(
  health: string | null | undefined,
): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (health) {
    case 'GOOD':
      return 'good';
    case 'BAD':
      return 'warn';
    case 'CRITICAL':
      return 'bad';
    default:
      return 'neutral';
  }
}

/** Tom do turno a partir do tempo ("M3" manhã, "T1" tarde, "N2" noite). */
export function shiftTone(slot: string): 'morning' | 'afternoon' | 'night' {
  if (slot.includes('M')) return 'morning';
  if (slot.includes('T')) return 'afternoon';
  return 'night';
}

export const SHIFT_LABEL = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
} as const;
