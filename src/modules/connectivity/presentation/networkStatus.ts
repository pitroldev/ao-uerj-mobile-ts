import { useSyncExternalStore } from 'react';
import type { NetworkStatus } from '../domain/networkStatus';

let currentStatus: NetworkStatus = 'online';
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): NetworkStatus => currentStatus;

export function setNetworkStatus(next: NetworkStatus): void {
  if (currentStatus === next) return;
  currentStatus = next;
  listeners.forEach(listener => listener());
}

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
