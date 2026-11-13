import React from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

import { useStepsContext } from '@hooks/useSteps';
import { Stepper } from '@components/ui';
import { ScreenPanel, type ScreenPanelProps } from '@templates/ScreenPanel';

import { STEP_LABELS } from '../format';
import { StepFooter, type StepFooterProps } from './StepFooter';

type GeneratorStepProps = {
  children?: React.ReactNode;
  /** Rodapé fixo: a situação das escolhas, "Anterior" e a ação do passo. */
  footer: StepFooterProps;
  /**
   * `false` quando o passo tem a sua própria `FlatList` (disciplinas);
   * aplique `useStepListStyle()` no `contentContainerStyle` dela.
   */
  scroll?: boolean;
  scrollProps?: ScreenPanelProps['scrollProps'];
  /**
   * O rodapé some enquanto o teclado está aberto: no passo com busca, ele e
   * o teclado juntos não deixariam ver os resultados.
   */
  footerYieldsToKeyboard?: boolean;
};

/**
 * Molde de cada passo do gerador: painel com o trilho de passos fixo no topo,
 * conteúdo rolável e o rodapé com a ação do passo.
 */
export function GeneratorStep({
  children,
  footer,
  scroll = true,
  scrollProps,
  footerYieldsToKeyboard = false,
}: GeneratorStepProps) {
  const { step, setStep } = useStepsContext();
  const typing = useKeyboardState(state => state.isVisible);

  return (
    <ScreenPanel
      scroll={scroll}
      scrollProps={scrollProps}
      header={
        <Stepper
          steps={STEP_LABELS}
          current={step + 1}
          onStepPress={n => {
            if (n - 1 <= step) setStep(n - 1);
          }}
        />
      }
      footer={
        footerYieldsToKeyboard && typing ? undefined : (
          <StepFooter {...footer} />
        )
      }
    >
      {children}
    </ScreenPanel>
  );
}
