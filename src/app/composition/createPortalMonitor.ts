import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { SharedPortalStatusPort } from '@root/modules/connectivity/application/ports';
import { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';

/**
 * Disponibilidade do Aluno Online: queda só com a internet do aparelho
 * funcionando, e nova tentativa automática só com o app na tela.
 */
export function createPortalMonitor(dependencies: {
  probe: () => Promise<number>;
  shared: SharedPortalStatusPort;
}) {
  return new PortalMonitor({
    now: Date.now,
    online: () => onlineManager.isOnline(),
    active: () => AppState.currentState === 'active',
    ...dependencies,
  });
}
