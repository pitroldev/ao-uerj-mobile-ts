import React, {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { snackbar } from '@components/ui/Snackbar';
import { PortalStatusProvider } from '@root/modules/connectivity/presentation/PortalStatusContext';
import type { AppServices } from '../composition/createAppServices';

const ServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: React.PropsWithChildren<{ services: AppServices }>) {
  useEffect(() => {
    void services.initialize().then(warning => {
      if (warning) snackbar.error(warning);
    });
    const unsubscribe = NetInfo.addEventListener(state => {
      onlineManager.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    });
    const listener = AppState.addEventListener('change', status => {
      // Focus revalidates stale queries. The AO coordinator renews only when a
      // request proves expiry; resuming must not destroy a healthy session.
      focusManager.setFocused(status === 'active');
      if (status === 'active') services.portalMonitor.resume();
      else void services.flushCache().catch(() => undefined);
    });
    // O portal voltou: as telas que falharam na queda consultam de novo (as
    // outras seguem o tempo de validade), e o pedido de aviso se cumpre aqui.
    const recovered = services.portalMonitor.onRecovered(() => {
      if (!focusManager.isFocused()) return;
      snackbar.success('O Aluno Online voltou.', 'Atualizando seus dados…');
      void services.notifications.portalReturn
        ?.portalBack()
        .catch(() => undefined);
      void services.queryClient.refetchQueries({
        type: 'active',
        predicate: query => query.state.status === 'error' || query.isStale(),
      });
    });
    return () => {
      unsubscribe();
      listener.remove();
      recovered();
    };
  }, [services]);
  return (
    <ServicesContext.Provider value={services}>
      <PortalStatusProvider
        monitor={services.portalMonitor}
        identity={services.identity}
        alert={services.notifications.portalReturn}
      >
        {children}
      </PortalStatusProvider>
    </ServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('AppServicesProvider ausente.');
  return services;
}

export function useIdentity() {
  const { identity } = useAppServices();
  return useSyncExternalStore(
    identity.subscribe,
    identity.getSnapshot,
    identity.getSnapshot,
  );
}
