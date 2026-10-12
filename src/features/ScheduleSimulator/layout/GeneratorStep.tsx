import React from 'react';

import { useStepsContext } from '@hooks/useSteps';
import { Stepper } from '@components/ui';
import ScreenPanel, { type ScreenPanelProps } from '@templates/ScreenPanel';

import { STEP_LABELS } from '../format';
import { StepFooter, type StepFooterProps } from './StepFooter';

export type GeneratorStepProps = {
  children?: React.ReactNode;
  /** Rodapé fixo: "Anterior" e a ação principal do passo. */
  footer: StepFooterProps;
  /**
   * `false` quando o passo tem a sua própria `FlatList` (disciplinas e
   * turmas); aplique `useStepListStyle()` no `contentContainerStyle` dela.
   */
  scroll?: boolean;
  scrollProps?: ScreenPanelProps['scrollProps'];
};

/**
 * Molde de cada passo do gerador: painel com o trilho de passos fixo no topo,
 * conteúdo rolável e o rodapé Anterior/Próximo.
 */
export function GeneratorStep({
  children,
  footer,
  scroll = true,
  scrollProps,
}: GeneratorStepProps) {
  const { step, setStep } = useStepsContext();

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
      footer={<StepFooter {...footer} />}
    >
      {children}
    </ScreenPanel>
  );
}

export default GeneratorStep;
