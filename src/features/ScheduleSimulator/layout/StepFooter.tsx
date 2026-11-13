import React, { useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button, type IconName } from '@components/ui';

type StepAction = {
  label: string;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  onPress?: () => unknown;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  /** `outline` para a ação que não é o caminho principal ("Começar de novo"). */
  variant?: 'primary' | 'outline';
};

export type StepFooterProps = {
  /** Sem `onPrev` (primeiro passo), só a ação principal, na largura toda. */
  onPrev?: () => void;
  prevDisabled?: boolean;
  /** Ação principal à direita (Próximo, Ver grades, Começar de novo). */
  next: StepAction;
  /**
   * Linha acima dos botões (`FooterStatus`): o efeito das escolhas do passo,
   * sempre à vista enquanto a lista ou a tabela rolam.
   */
  status?: React.ReactNode;
};

const Column = styled.View`
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const Row = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Slot = styled.View``;

type Natural = [number | null, number | null];

/**
 * Larguras como no ".panel-foot" do protótipo (`flex: 1` com `nowrap`): os
 * dois botões dividem a linha por igual e, se um rótulo não couber na metade,
 * ele fica com a largura natural e o outro com o resto. Se nem assim couber
 * (tela estreita ou fonte grande), "Anterior" vira só a seta.
 */
function FooterRow({ onPrev, prevDisabled, next }: StepFooterProps) {
  const theme = useTheme();
  const [width, setWidth] = useState<number | null>(null);
  const [natural, setNatural] = useState<Natural>([null, null]);
  const measured = natural[0] != null && natural[1] != null;

  const onSlotLayout = (index: 0 | 1) => (e: LayoutChangeEvent) => {
    if (measured) return;
    const value = e.nativeEvent.layout.width;
    setNatural(prev => {
      if (prev[index] === value) return prev;
      const copy: Natural = [prev[0], prev[1]];
      copy[index] = value;
      return copy;
    });
  };

  let widths: [number, number] | null = null;
  let compact = false;
  if (measured && width != null) {
    const available = width - theme.spacing.md;
    const [a, b] = natural as [number, number];
    const half = available / 2;
    if (a + b > available) {
      compact = true;
      widths = [theme.sizes.touch, available - theme.sizes.touch];
    } else if (a <= half && b <= half) {
      widths = [half, half];
    } else if (b > half) {
      widths = [available - b, b];
    } else {
      widths = [a, available - a];
    }
  }

  const slotStyle = (index: 0 | 1) =>
    widths ? { width: widths[index] } : styles.natural;

  return (
    <Row onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Slot style={slotStyle(0)} onLayout={onSlotLayout(0)}>
        <Button
          variant="outline"
          icon="arrow_back"
          label={compact ? undefined : 'Anterior'}
          accessibilityLabel="Anterior"
          disabled={prevDisabled}
          onPress={onPrev}
        />
      </Slot>
      <Slot style={slotStyle(1)} onLayout={onSlotLayout(1)}>
        <Button
          variant={next.variant}
          label={next.label}
          icon={next.icon}
          iconPosition={next.iconPosition}
          disabled={next.disabled}
          loading={next.loading}
          loadingLabel={next.loadingLabel}
          onPress={next.onPress}
        />
      </Slot>
    </Row>
  );
}

/**
 * Rodapé fixo do gerador: a situação das escolhas (opcional), "Anterior" e a
 * ação do passo. No primeiro passo, só a ação, na largura toda.
 */
export function StepFooter(props: StepFooterProps) {
  const { fontScale } = useWindowDimensions();
  const { next, onPrev, status } = props;
  // mede de novo quando o rótulo ou o tamanho da fonte mudam
  const key = [
    next.label,
    next.loading ? next.loadingLabel : '',
    next.icon,
    next.variant,
    fontScale,
  ].join('|');
  return (
    <Column>
      {status}
      {onPrev ? (
        <FooterRow key={key} {...props} />
      ) : (
        <Button
          block
          variant={next.variant}
          label={next.label}
          icon={next.icon}
          iconPosition={next.iconPosition}
          disabled={next.disabled}
          loading={next.loading}
          loadingLabel={next.loadingLabel}
          onPress={next.onPress}
        />
      )}
    </Column>
  );
}

const styles = StyleSheet.create({
  natural: { flexGrow: 0, flexShrink: 0 },
});
