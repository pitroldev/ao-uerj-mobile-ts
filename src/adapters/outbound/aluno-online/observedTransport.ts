import { AppError } from '@root/shared/errors/AppError';
import type { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import type { PortalTransport } from './contracts';

type Monitor = Pick<PortalMonitor, 'guard' | 'answered' | 'failed'>;

/**
 * Toda requisição ao portal passa pelo monitor: com o portal fora do ar ela
 * falha na hora (`SERVICE_UNAVAILABLE`), e cada resposta ou falha de rede
 * atualiza a disponibilidade. Cancelamentos não contam.
 */
export function observePortalTransport(
  transport: PortalTransport,
  monitor: Monitor,
  now: () => number = Date.now,
): PortalTransport {
  return {
    async request(request) {
      monitor.guard();
      const started = now();
      try {
        const response = await transport.request(request);
        monitor.answered(response.status, now() - started);
        return response;
      } catch (error) {
        if (error instanceof AppError && error.code === 'NETWORK')
          monitor.failed('network');
        throw error;
      }
    },
    cancelAndDrain: () => transport.cancelAndDrain(),
  };
}
