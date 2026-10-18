import { useEffect, useRef } from 'react';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { navigate } from '@services/rootNavigation';
import type { NotificationTarget } from '../domain/messages';

const ROUTES = {
  home: 'Início',
  documents: 'Emissão de Documentos',
} as const satisfies Record<NotificationTarget, string>;

function open(target: NotificationTarget) {
  navigate(ROUTES[target]);
}

/**
 * Aviso tocado: abre a tela dele quando a navegação e a conta estiverem
 * prontas (na abertura do app a conta ainda é restaurada).
 */
export function NotificationLaunchHandler({ ready }: { ready: boolean }) {
  const { launches } = useAppServices().notifications;
  const { status } = useIdentity();
  const canOpen = ready && (status === 'signedIn' || status === 'refreshing');
  const allowed = useRef(false);
  const pending = useRef<NotificationTarget | null>(null);

  useEffect(() => {
    allowed.current = canOpen;
    const target = pending.current;
    if (!canOpen || !target) return;
    pending.current = null;
    open(target);
  }, [canOpen]);

  // o destino de abertura é lido uma vez; os toques seguintes chegam por evento
  useEffect(() => {
    if (!launches) return;
    let active = true;
    const receive = (target: NotificationTarget) => {
      if (allowed.current) open(target);
      else pending.current = target;
    };
    void launches.consume().then(target => {
      if (active && target) receive(target);
    });
    const unsubscribe = launches.subscribe(receive);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [launches]);

  return null;
}
