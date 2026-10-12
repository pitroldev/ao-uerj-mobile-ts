import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * `true` quando o sistema pede menos movimento ("Remover animações").
 * Animações de estado devem pular direto para o valor final nesse caso.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(value => {
        if (active) setReduced(Boolean(value));
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      value => setReduced(Boolean(value)),
    );
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}
