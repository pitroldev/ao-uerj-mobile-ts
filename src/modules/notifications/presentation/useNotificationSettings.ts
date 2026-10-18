import { useSyncExternalStore } from 'react';

import { useAppServices } from '@root/app/providers/AppServicesProvider';

/** Preferências de aviso da conta ativa e o controlador para mudá-las. */
export function useNotificationSettings() {
  const { settings } = useAppServices().notifications;
  const snapshot = useSyncExternalStore(
    settings.subscribe,
    settings.getSnapshot,
    settings.getSnapshot,
  );
  return { snapshot, settings };
}
