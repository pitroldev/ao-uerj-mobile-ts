import React, {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type { AppServices } from '../composition/createAppServices';

const ServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: React.PropsWithChildren<{ services: AppServices }>) {
  useEffect(() => {
    void services.initialize().then(warning => {
      if (warning) Toast.show({ type: 'error', text1: warning });
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
      if (status !== 'active')
        void services.flushCache().catch(() => undefined);
    });
    return () => {
      unsubscribe();
      listener.remove();
    };
  }, [services]);
  return (
    <ServicesContext.Provider value={services}>
      {children}
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
