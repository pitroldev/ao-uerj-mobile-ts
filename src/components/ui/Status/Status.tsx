import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { numberToColor } from '@utils/numberToColor';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { HEALTH_LABEL, healthTone, toneColors, type UiTone } from '../tones';

/* --------------------------------------------------------------- StatusLabel */

export type StatusLabelProps = {
  tone: UiTone;
  label: string;
  /** Ícone no lugar do ponto ("check" em "Encerrada", "star" em "Preferencial"). */
  icon?: IconName;
  /** Texto secundário com o ponto colorido (legendas). */
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
};

const Inline = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.View<{ $color: string; $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => $size / 2}px;
  background-color: ${({ $color }) => $color};
`;

const StatusIcon = styled.View`
  margin: 0px -2px;
`;

/**
 * Status com ponto + rótulo (".st"): "● Bom na P1", "● Tarde". Nunca só cor:
 * o rótulo sempre acompanha o ponto.
 */
export function StatusLabel({
  tone,
  label,
  icon,
  muted = false,
  style,
}: StatusLabelProps) {
  const theme = useTheme();
  const ink = toneColors(theme, tone).ink;
  return (
    <Inline style={style}>
      {icon ? (
        <StatusIcon>
          <Icon name={icon} size={theme.sizes.icon.xs} color={ink} />
        </StatusIcon>
      ) : (
        <Dot $color={ink} $size={7} />
      )}
      <Text
        variant="caption"
        weight={muted ? 'regular' : 'medium'}
        color={muted ? theme.colors.inkMuted : ink}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Inline>
  );
}

/* ----------------------------------------------------------------------- Tag */

export type TagProps = {
  label: string;
  /** Padrão `neutral`. */
  tone?: UiTone;
  icon?: IconName;
  /** Ponto antes do rótulo. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TagBox = styled.View<{ $bg: string }>`
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  min-height: ${({ theme }) => theme.sizes.tag}px;
  padding: 0px 8px;
  border-radius: ${({ theme }) => theme.radii.sm}px;
  border-top-right-radius: 0px;
  background-color: ${({ $bg }) => $bg};
`;

/**
 * Etiqueta pastel pequena (".tag"): "Hoje", "Sem meta", "Trava de 140
 * créditos" (warn + lock). 24dp, canto cortado.
 */
export function Tag({
  label,
  tone = 'neutral',
  icon,
  dot = false,
  style,
}: TagProps) {
  const theme = useTheme();
  const t = toneColors(theme, tone);
  return (
    <TagBox $bg={t.bg} style={style}>
      {icon ? (
        <Icon name={icon} size={theme.sizes.icon.sm} color={t.ink} />
      ) : null}
      {dot && !icon ? <Dot $color={t.ink} $size={6} /> : null}
      <Text variant="caption" color={t.ink}>
        {label}
      </Text>
    </TagBox>
  );
}

/* ----------------------------------------------------------------- GradeCell */

/** "8,5" (uma casa, vírgula). */
export function formatGrade(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace('.', ',');
}

export type GradeCellProps = {
  /** Nota de 0 a 10; `null`/`undefined` mostra "–". */
  value: number | null | undefined;
  /** Tom explícito. Padrão: saúde da nota (≥7 bom, ≥5 atenção, abaixo crítico). */
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  /** `lg` para destaque (48×32, 15px). */
  size?: 'md' | 'lg';
  decimals?: number;
  /** Rótulo acessível. Padrão "Nota 8,5, Bom" ou "sem nota". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const GradeBox = styled.View<{ $w: number; $h: number; $bg: string }>`
  min-width: ${({ $w }) => $w}px;
  height: ${({ $h }) => $h}px;
  padding: 0px 6px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.sm}px;
  border-top-right-radius: 0px;
  background-color: ${({ $bg }) => $bg};
`;

/**
 * Célula de nota tingida (".gp"): fundo pastel da saúde e algarismos
 * tabulares. Acompanhe com um `StatusLabel` na linha, pois a cor sozinha não
 * basta.
 */
export function GradeCell({
  value,
  tone,
  size = 'md',
  decimals = 1,
  accessibilityLabel,
  style,
}: GradeCellProps) {
  const theme = useTheme();
  const box =
    size === 'lg' ? theme.sizes.gradeCellLarge : theme.sizes.gradeCell;
  const empty = value == null || Number.isNaN(value);
  const health = empty
    ? null
    : (tone ?? healthTone(numberToColor(value as number, 10)));
  const t = health ? toneColors(theme, health) : null;
  const text = empty ? '–' : formatGrade(value as number, decimals);
  return (
    <GradeBox
      $w={box.width}
      $h={box.height}
      $bg={t ? t.bg : 'transparent'}
      style={style}
      accessible
      accessibilityLabel={
        accessibilityLabel ??
        (health ? `Nota ${text}, ${HEALTH_LABEL[health]}` : 'sem nota')
      }
    >
      <Text
        variant={size === 'lg' ? 'body' : 'callout'}
        weight={empty ? 'regular' : 'semibold'}
        color={t ? t.ink : theme.colors.inkMuted}
        tabular
        numberOfLines={1}
      >
        {text}
      </Text>
    </GradeBox>
  );
}

/* --------------------------------------------------------------- ProgressBar */

export type ProgressBarProps = {
  /** Progresso de 0 a 1. */
  value: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  /** 4dp (dentro de células de vagas) em vez de 6dp. */
  thin?: boolean;
  /** Obrigatório para leitores de tela ("Obrigatórias", "Ocupadas: 40 de 45"). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

const Track = styled.View<{ $h: number }>`
  height: ${({ $h }) => $h}px;
  border-radius: ${({ $h }) => $h / 2}px;
  background-color: ${({ theme }) => theme.colors.surfaceStrong};
  overflow: hidden;
`;

const Fill = styled.View<{ $h: number; $pct: number; $color: string }>`
  width: ${({ $pct }) => $pct * 100}%;
  height: 100%;
  border-radius: ${({ $h }) => $h / 2}px;
  background-color: ${({ $color }) => $color};
`;

/** Barra de progresso (".bar"): trilho `surfaceStrong` e preenchimento do tom. */
export function ProgressBar({
  value,
  tone = 'accent',
  thin = false,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = tone === 'accent' ? theme.colors.accent : theme.status[tone].ink;
  const h = thin ? theme.sizes.progressBarThin : theme.sizes.progressBar;
  return (
    <Track
      $h={h}
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <Fill $h={h} $pct={pct} $color={fill} />
    </Track>
  );
}
