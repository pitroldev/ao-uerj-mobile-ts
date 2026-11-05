import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { usePositiveMoment } from '@root/modules/delivery/presentation/DeliveryProvider';

/** O aluno vê o app aberto antes da folha da loja. */
const GOOD_NEWS_DELAY = 2_500;

/**
 * Com o Início montado: a verificação em segundo plano achou uma boa notícia
 * (vaga confirmada, aprovação nas notas) que o aluno ainda não viu no app.
 * Ela conta uma vez como momento bom, um instante depois de o app abrir ou
 * voltar para a frente (o toque no aviso traz o aluno de volta).
 */
export function useGoodNewsMoment() {
  const { notifications } = useAppServices();
  const positiveMoment = usePositiveMoment();
  useEffect(() => {
    const { goodNews } = notifications;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (AppState.currentState === 'background') return;
        goodNews.take().then(
          fresh => {
            if (fresh) positiveMoment();
          },
          () => undefined,
        );
      }, GOOD_NEWS_DELAY);
    };
    check();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      listener.remove();
      if (timer) clearTimeout(timer);
    };
  }, [notifications, positiveMoment]);
}
