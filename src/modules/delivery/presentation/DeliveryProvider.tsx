import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, Platform } from 'react-native';

import { snackbar } from '@components/ui';
import type { AppUpdates, UpdateSnapshot } from '../application/AppUpdates';
import type {
  RemoteStatus,
  RemoteStatusSnapshot,
} from '../application/RemoteStatus';
import type { ReviewPrompter } from '../application/ReviewPrompter';
import { isVersionSupported, visibleNotices } from '../domain/appStatus';
import { UpdateRequired } from './UpdateRequired';

export type Delivery = {
  appVersion: string;
  status: RemoteStatus;
  updates: AppUpdates;
  review: Pick<ReviewPrompter, 'notePositiveMoment'>;
};

/** Sem provedor (testes de telas, Storybook) tudo fica inerte: sem avisos nem bloqueios. */
const DeliveryContext = createContext<Delivery | null>(null);

const NO_STATUS: RemoteStatusSnapshot = { status: null, dismissed: new Set() };
const NO_UPDATE: UpdateSnapshot = {
  phase: 'idle',
  progress: null,
  storeUpToDate: false,
};
const noSubscription = () => () => undefined;
const noStatus = () => NO_STATUS;
const noUpdate = () => NO_UPDATE;

type Props = React.PropsWithChildren<{
  delivery: Delivery;
  /** Navegação pronta: só então a loja pode abrir a tela de atualização. */
  ready: boolean;
}>;

/**
 * Aviso remoto (busca na abertura e ao voltar ao primeiro plano), atualização
 * pela loja depois da navegação pronta e bloqueio de versão sem suporte.
 */
export function DeliveryProvider({ delivery, ready, children }: Props) {
  const { appVersion, status, updates } = delivery;
  const { status: current } = useSyncExternalStore(
    status.subscribe,
    status.getSnapshot,
    status.getSnapshot,
  );
  const { storeUpToDate } = useSyncExternalStore(
    updates.subscribe,
    updates.getSnapshot,
    updates.getSnapshot,
  );
  const supported = isVersionSupported(appVersion, current);
  // Abaixo da mínima, mas a Play diz que não há versão nova para este
  // aparelho (rollout parcial, versão ainda não promovida, mínima errada ou
  // adulterada no aviso): bloquear prenderia o aluno sem nada a instalar. No
  // iOS e fora da Play não há como confirmar, e a versão mínima vale sozinha.
  const blocked = !supported && !storeUpToDate;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void status.start().then(() => setLoaded(true));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void status.refresh();
    });
    return () => listener.remove();
  }, [status]);

  useEffect(() => updates.listen(), [updates]);

  useEffect(() => {
    let previous = updates.getSnapshot().phase;
    return updates.subscribe(() => {
      const { phase } = updates.getSnapshot();
      // o aviso com "Reiniciar" fica no Início; o snackbar só avisa que chegou
      if (previous === 'downloading' && phase === 'downloaded')
        snackbar.success(
          'Nova versão baixada',
          'Toque em “Reiniciar” no Início para instalar.',
        );
      previous = phase;
    });
  }, [updates]);

  useEffect(() => {
    // espera o aviso remoto (cópia salva e busca): sem suporte, a imediata vem
    // no lugar da flexível
    if (!ready || !loaded) return;
    const required = !supported;
    // só com o app na frente: com a tela da loja por cima (aberta pelo
    // "Atualizar" antes de a busca terminar), o app fica em 'background' e um
    // check agora abriria outro fluxo; a volta ao app checa
    if (AppState.currentState !== 'background')
      void updates.check({ required });
    // retoma a imediata interrompida e acha a flexível baixada em segundo plano
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void updates.check({ required });
    });
    return () => listener.remove();
  }, [ready, loaded, supported, updates]);

  return (
    <DeliveryContext.Provider value={delivery}>
      {children}
      {blocked ? (
        <UpdateRequired
          appVersion={appVersion}
          onUpdate={updates.canUpdate ? () => updates.updateNow() : undefined}
        />
      ) : null}
    </DeliveryContext.Provider>
  );
}

export function useDelivery(): Delivery | null {
  return useContext(DeliveryContext);
}

export function useRemoteStatus(): RemoteStatusSnapshot {
  const status = useDelivery()?.status;
  return useSyncExternalStore(
    status?.subscribe ?? noSubscription,
    status?.getSnapshot ?? noStatus,
    status?.getSnapshot ?? noStatus,
  );
}

export function useUpdateSnapshot(): UpdateSnapshot {
  const updates = useDelivery()?.updates;
  return useSyncExternalStore(
    updates?.subscribe ?? noSubscription,
    updates?.getSnapshot ?? noUpdate,
    updates?.getSnapshot ?? noUpdate,
  );
}

/** Avisos vigentes não dispensados (a validade é conferida ao montar a tela). */
export function useRemoteNotices() {
  const delivery = useDelivery();
  const { status, dismissed } = useRemoteStatus();
  const [now] = useState(Date.now);
  const notices = visibleNotices(status, {
    now,
    platform: Platform.OS,
    dismissed,
  });
  const dismiss = useCallback(
    (id: string) => {
      void delivery?.status.dismiss(id);
    },
    [delivery],
  );
  return { notices, dismiss };
}

/**
 * Registra um momento positivo (grade compartilhada, grades geradas); a
 * avaliação na loja só aparece se a política deixar.
 */
export function usePositiveMoment(): () => void {
  const delivery = useDelivery();
  return useCallback(() => {
    void delivery?.review.notePositiveMoment();
  }, [delivery]);
}
