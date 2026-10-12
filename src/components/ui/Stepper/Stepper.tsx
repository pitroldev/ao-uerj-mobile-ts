import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { EdgeFade } from '../EdgeFade';
import { Icon } from '../Icon';
import { Text } from '../Text';

export type StepperProps = {
  /** Rótulos dos passos ("Qtd. Disciplinas", "Horários Ocupados"…). */
  steps: string[];
  /** Passo atual, começando em 1. */
  current: number;
  /** Toque num passo já visitado (ou no atual). Passos futuros ficam desabilitados. */
  onStepPress?: (step: number) => void;
  /** Cor atrás do trilho, para o esmaecimento das bordas. Padrão `surface`. */
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
};

const Item = styled.View`
  flex-direction: row;
  align-items: center;
`;

const Connector = styled.View<{ $done: boolean }>`
  width: 14px;
  height: 1px;
  margin: 0px 4px;
  background-color: ${({ theme, $done }) =>
    $done ? theme.colors.accentLine : theme.colors.ruleStrong};
`;

const Step = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  padding: 0px 10px 0px 4px;
  border-radius: 24px;
`;

const StepNumber = styled.View<{ $done: boolean; $current: boolean }>`
  width: ${({ theme }) => theme.sizes.stepNumber}px;
  height: ${({ theme }) => theme.sizes.stepNumber}px;
  border-radius: 12px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $done, $current }) =>
    $current
      ? theme.colors.accent
      : $done
      ? theme.colors.accentLine
      : theme.colors.ruleStrong};
  background-color: ${({ theme, $done, $current }) =>
    $current
      ? theme.colors.accent
      : $done
      ? theme.colors.accentSoft
      : 'transparent'};
  align-items: center;
  justify-content: center;
`;

/**
 * Trilho de passos do gerador (".steps"): número em círculo, rótulo e fio
 * entre os passos; concluídos com "check"; rola sozinho até o passo atual.
 */
export function Stepper({
  steps,
  current,
  onStepPress,
  fadeColor,
  style,
}: StepperProps) {
  const theme = useTheme();
  const c = theme.colors;
  const scroll = useRef<ScrollView>(null);
  const [xs, setXs] = useState<number[]>([]);

  useEffect(() => {
    const target = xs[current - 2] ?? xs[current - 1];
    if (target == null) return;
    // mostra o passo anterior inteiro, com 20 de margem
    scroll.current?.scrollTo({ x: Math.max(0, target - 20), animated: false });
  }, [current, xs]);

  const onItemLayout = (i: number) => (e: LayoutChangeEvent) => {
    const x = e.nativeEvent.layout.x;
    setXs(prev => {
      if (prev[i] === x) return prev;
      const next = [...prev];
      next[i] = x;
      return next;
    });
  };

  return (
    <View style={style}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Passos do gerador"
        style={styles.rail}
        contentContainerStyle={{
          paddingLeft: theme.spacing.lg,
          paddingRight: theme.spacing.xxxl,
          paddingBottom: theme.spacing.sm,
        }}
      >
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const cur = n === current;
          return (
            <Item key={label} onLayout={onItemLayout(i)}>
              {i > 0 ? <Connector $done={n <= current} /> : null}
              <Step
                onPress={() => onStepPress?.(n)}
                disabled={n > current || !onStepPress}
                accessibilityRole="button"
                accessibilityLabel={`Passo ${n} de ${steps.length}: ${label}${
                  done ? ', concluído' : cur ? ', atual' : ''
                }`}
                accessibilityState={{ disabled: n > current, selected: cur }}
                style={({ pressed }) =>
                  pressed && { backgroundColor: c.surfaceMuted }
                }
              >
                <StepNumber $done={done} $current={cur}>
                  {done ? (
                    <Icon
                      name="check"
                      size={theme.sizes.icon.sm}
                      color={c.accent}
                    />
                  ) : (
                    <Text
                      variant="caption"
                      weight="semibold"
                      color={cur ? c.onAccent : c.inkMuted}
                      tabular
                      maxFontSizeMultiplier={1.3}
                    >
                      {n}
                    </Text>
                  )}
                </StepNumber>
                <Text
                  variant="meta"
                  weight={cur ? 'semibold' : 'medium'}
                  color={cur || done ? c.ink : c.inkMuted}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Step>
            </Item>
          );
        })}
      </ScrollView>
      {/* ".steps" mask-image: 14 no início, 24 no fim */}
      <EdgeFade side="start" width={14} color={fadeColor} />
      <EdgeFade side="end" width={24} color={fadeColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ScrollView puro: o styled não repassa ref no React 19
  rail: { flexGrow: 0 },
});

export default Stepper;
