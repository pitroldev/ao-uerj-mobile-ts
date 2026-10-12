import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Estado compartilhado do cabeçalho global. O `Header` fica fora do
 * navegador (só o conteúdo desliza com o menu), então as telas falam com ele
 * por aqui, sem provider.
 */
type HeaderState = {
  /** Quando definido, o botão da esquerda vira "Voltar" e chama esta função. */
  onBack: (() => void) | null;
  /** Rótulo acessível do botão voltar. */
  backLabel: string;
};

let state: HeaderState = { onBack: null, backLabel: 'Voltar' };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export const headerStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setBack(onBack: (() => void) | null, backLabel = 'Voltar') {
    if (state.onBack === onBack && state.backLabel === backLabel) return;
    state = { onBack, backLabel };
    emit();
  },
};

export function useHeaderState(): HeaderState {
  return useSyncExternalStore(
    headerStore.subscribe,
    headerStore.getSnapshot,
    headerStore.getSnapshot,
  );
}

/**
 * Mostra a seta "Voltar" no cabeçalho azul enquanto a tela estiver em foco e
 * `onBack` for uma função. Passe `null`/`undefined` para voltar ao menu.
 *
 *   useHeaderBack(selected ? () => setSelected(null) : null);
 *
 * Não trata o botão voltar do Android; para isso use `useBackHandler`.
 */
export function useHeaderBack(
  onBack: (() => void) | null | undefined,
  backLabel = 'Voltar',
) {
  const latest = useRef(onBack);
  latest.current = onBack;
  const enabled = Boolean(onBack);
  const stableBack = useCallback(() => latest.current?.(), []);

  useFocusEffect(
    useCallback(() => {
      headerStore.setBack(enabled ? stableBack : null, backLabel);
      return () => {
        if (headerStore.getSnapshot().onBack === stableBack) {
          headerStore.setBack(null);
        }
      };
    }, [backLabel, enabled, stableBack]),
  );

  useEffect(
    () => () => {
      if (headerStore.getSnapshot().onBack === stableBack) {
        headerStore.setBack(null);
      }
    },
    [stableBack],
  );
}
