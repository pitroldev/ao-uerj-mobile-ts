import { useSyncExternalStore } from 'react';

/** Folhas montadas agora (abertas ou terminando de fechar). */
let count = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach(listener => listener());
}

const anyOpen = () => count > 0;

/** Marca uma folha na tela; devolve a função que a retira. */
export function trackOpenSheet(): () => void {
  count += 1;
  emit();
  return () => {
    count -= 1;
    emit();
  };
}

/**
 * `true` enquanto houver uma folha na tela. A folha é uma janela à parte e
 * sobe sozinha com o teclado: o painel da tela por trás não deve reagir ao
 * teclado aberto por ela.
 */
export function useSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, anyOpen);
}
