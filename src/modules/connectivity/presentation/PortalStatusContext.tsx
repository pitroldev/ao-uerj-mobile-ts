import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { snackbar } from '@components/ui/Snackbar';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type {
  PortalReturnAlert,
  PortalReturnSnapshot,
} from '@root/modules/notifications/application/PortalReturnAlert';
import { PORTAL_UP } from '../domain/portalAvailability';
import type {
  PortalMonitor,
  PortalSnapshot,
} from '../application/PortalMonitor';

type PortalReturnRequest = {
  /** Só no Android, onde há avisos nativos. */
  supported: boolean;
  requested: boolean;
  request: () => Promise<void>;
  cancel: () => Promise<void>;
};

export type PortalStatusValue = PortalSnapshot & {
  down: boolean;
  /** A conta salva já aparece e o login da abertura ainda corre. */
  signingIn: boolean;
  retryNow: () => Promise<void>;
  returnAlert: PortalReturnRequest;
};

const NO_ALERT: PortalReturnRequest = {
  supported: false,
  requested: false,
  request: () => Promise.resolve(),
  cancel: () => Promise.resolve(),
};

/** Sem provedor (telas isoladas, testes): o portal está no ar. */
const IDLE: PortalStatusValue = {
  ...PORTAL_UP,
  shared: null,
  observedAt: 0,
  down: false,
  signingIn: false,
  retryNow: () => Promise.resolve(),
  returnAlert: NO_ALERT,
};

const PortalStatusContext = createContext<PortalStatusValue>(IDLE);

const NONE: PortalReturnSnapshot = { scope: null, requested: false };
const noSubscription = () => () => undefined;
const noSnapshot = () => NONE;

type Props = React.PropsWithChildren<{
  monitor: PortalMonitor;
  identity: Pick<IdentityController, 'subscribe' | 'getSnapshot'>;
  /** "Avisar quando voltar" (`null` onde não há avisos nativos). */
  alert: PortalReturnAlert | null;
}>;

/** Disponibilidade do Aluno Online para as telas (montado com os serviços). */
export function PortalStatusProvider({
  monitor,
  identity,
  alert,
  children,
}: Props) {
  const snapshot = useSyncExternalStore(
    monitor.subscribe,
    monitor.getSnapshot,
    monitor.getSnapshot,
  );
  const { status, account } = useSyncExternalStore(
    identity.subscribe,
    identity.getSnapshot,
    identity.getSnapshot,
  );
  const alertSnapshot = useSyncExternalStore(
    alert?.subscribe ?? noSubscription,
    alert?.getSnapshot ?? noSnapshot,
    alert?.getSnapshot ?? noSnapshot,
  );
  const scope = account?.scope ?? null;
  useEffect(() => {
    void alert?.load();
  }, [alert, scope]);

  const value = useMemo<PortalStatusValue>(() => {
    const returnAlert: PortalReturnRequest = alert
      ? {
          supported: true,
          requested: alertSnapshot.scope === scope && alertSnapshot.requested,
          async request() {
            const result = await alert.request().catch(() => 'denied' as const);
            if (result === 'requested')
              snackbar.success('Vamos avisar quando o Aluno Online voltar.');
            else
              snackbar.error(
                'Não foi possível pedir o aviso.',
                'Permita as notificações do AO UERJ nas configurações do Android.',
              );
          },
          cancel: () => alert.cancel(),
        }
      : NO_ALERT;
    return {
      ...snapshot,
      down: snapshot.state === 'down',
      signingIn: status === 'restoring' && account !== null,
      retryNow: () => monitor.retryNow(),
      returnAlert,
    };
  }, [account, alert, alertSnapshot, monitor, scope, snapshot, status]);

  return (
    <PortalStatusContext.Provider value={value}>
      {children}
    </PortalStatusContext.Provider>
  );
}

/** Disponibilidade do Aluno Online (queda, lentidão e a situação no servidor). */
export function usePortalStatus(): PortalStatusValue {
  return useContext(PortalStatusContext);
}
