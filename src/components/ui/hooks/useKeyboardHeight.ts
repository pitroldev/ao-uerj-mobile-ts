import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

function currentHeight(): number {
  return Keyboard.isVisible?.() ? (Keyboard.metrics?.()?.height ?? 0) : 0;
}

/**
 * Altura do teclado virtual em dp (0 quando fechado), pelos eventos
 * `keyboardDidShow`/`keyboardDidHide`. No Android a altura já desconta a
 * barra de navegação. Com `enabled` falso não escuta nada e devolve 0.
 *
 * Serve às sobreposições de ponta a ponta (folha inferior no Android 15+),
 * em que o sistema não redimensiona a janela quando o teclado abre.
 */
export function useKeyboardHeight(enabled = true): number {
  const [height, setHeight] = useState(() => (enabled ? currentHeight() : 0));
  useEffect(() => {
    if (!enabled) return;
    setHeight(currentHeight());
    const show = Keyboard.addListener('keyboardDidShow', event =>
      setHeight(event.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled ? height : 0;
}
