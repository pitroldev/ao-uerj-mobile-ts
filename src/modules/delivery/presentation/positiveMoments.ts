import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { usePositiveMoment } from './DeliveryProvider';

/**
 * Um momento bom que só conta quando o aluno sai da tela, com a escolha
 * feita (a formatura do plano): a avaliação não aparece no meio da
 * comparação. Devolve a função que marca o momento.
 */
export function useMomentOnLeave(): () => void {
  const positiveMoment = usePositiveMoment();
  const pending = useRef(false);
  useFocusEffect(
    useCallback(
      () => () => {
        if (!pending.current) return;
        pending.current = false;
        positiveMoment();
      },
      [positiveMoment],
    ),
  );
  return useCallback(() => {
    pending.current = true;
  }, []);
}

/**
 * Um momento bom que conta um instante depois (o "Valeu" recebido): dá
 * tempo de o aluno ver o que aconteceu antes da folha da loja. Sair da tela
 * antes cancela.
 */
export function useDelayedMoment(delay: number): () => void {
  const positiveMoment = usePositiveMoment();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      positiveMoment();
    }, delay);
  }, [delay, positiveMoment]);
}
