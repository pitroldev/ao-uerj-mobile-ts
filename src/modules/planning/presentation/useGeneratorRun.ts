import { useCallback } from 'react';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import type { GeneratorDiagnostic } from '@root/modules/support/application/ports';

/**
 * Anota contagens da tentativa atual no gerador (para o relato da tela).
 * Sem conta, não anota nada.
 */
export function useGeneratorRunNote() {
  const { generatorRuns } = useAppServices();
  const scope = useIdentity().account?.scope;
  return useCallback(
    (patch: Partial<GeneratorDiagnostic>) => {
      if (scope) generatorRuns.note(scope, patch);
    },
    [generatorRuns, scope],
  );
}

/** Começa uma tentativa nova ao abrir o gerador. */
export function useGeneratorRunStart() {
  const { generatorRuns } = useAppServices();
  const scope = useIdentity().account?.scope;
  return useCallback(() => {
    if (scope) generatorRuns.start(scope);
  }, [generatorRuns, scope]);
}
