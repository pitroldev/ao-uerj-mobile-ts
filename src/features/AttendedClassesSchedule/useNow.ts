import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Relógio da agenda: devolve a hora atual e se atualiza na virada de cada
 * minuto e quando o app volta ao primeiro plano (próxima aula, "Encerrada",
 * linha de agora).
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const current = new Date();
      const msToNextMinute =
        (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        Math.max(1000, msToNextMinute),
      );
    };
    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
}

export default useNow;
