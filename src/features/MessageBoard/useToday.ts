import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Data de hoje para os rótulos do mural ("Hoje", "Ontem") e para o período
 * sugerido. A conversa pode ficar aberta de um dia para o outro com o app em
 * memória: a data muda na virada do dia e quando o app volta ao primeiro plano
 * já em outro dia. No mesmo dia, devolve sempre o mesmo objeto e não provoca
 * render.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      const current = new Date();
      setToday(previous => (sameDay(previous, current) ? previous : current));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleMidnight = () => {
      const current = new Date();
      const midnight = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + 1,
      );
      timer = setTimeout(
        () => {
          refresh();
          scheduleMidnight();
        },
        Math.max(1000, midnight.getTime() - current.getTime()),
      );
    };
    scheduleMidnight();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
