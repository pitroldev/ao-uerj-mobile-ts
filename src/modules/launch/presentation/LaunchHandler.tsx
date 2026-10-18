import { useEffect, useRef } from 'react';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { navigate } from '@services/rootNavigation';
import { needsAccount, type LaunchTarget } from '../domain/launchTarget';

function open(target: LaunchTarget) {
  switch (target) {
    case 'home':
      navigate('Início');
      return;
    case 'grades':
      navigate('Início', { focus: 'grades' });
      return;
    case 'map':
      navigate('Mapa');
      return;
    case 'documents':
      navigate('Emissão de Documentos');
  }
}

type Access = {
  /** Navegação montada e conta já restaurada (com ou sem login). */
  known: boolean;
  signedIn: boolean;
};

function allowed(access: Access, target: LaunchTarget) {
  return access.known && (access.signedIn || !needsAccount(target));
}

/**
 * Aberturas vindas de fora do app (aviso tocado, atalho do ícone, widget):
 * abre a tela do destino quando a navegação estiver pronta e, se a tela pede
 * conta, depois do login (na abertura a conta ainda é restaurada).
 */
export function LaunchHandler({ ready }: { ready: boolean }) {
  const { launches } = useAppServices();
  const { status } = useIdentity();
  const known = ready && status !== 'restoring';
  const signedIn = status === 'signedIn' || status === 'refreshing';
  const access = useRef<Access>({ known: false, signedIn: false });
  const pending = useRef<LaunchTarget | null>(null);

  useEffect(() => {
    access.current = { known, signedIn };
    const target = pending.current;
    if (!target || !allowed(access.current, target)) return;
    pending.current = null;
    open(target);
  }, [known, signedIn]);

  // o destino da abertura é lido uma vez; as aberturas seguintes chegam por evento
  useEffect(() => {
    if (!launches) return;
    let active = true;
    const receive = (target: LaunchTarget) => {
      if (allowed(access.current, target)) open(target);
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
