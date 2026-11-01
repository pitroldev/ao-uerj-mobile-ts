import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  INITIAL_STATUS,
  isUp,
  nextStatus,
  type PortalStatus,
} from './domain.ts';
import type { PortalProbe, PortalWatch } from './ports.ts';

/**
 * Guarda só a situação do portal, atualizada a cada `check`. Quando consultar
 * é de quem chama (no servidor, um agendador em `adapters/inbound`).
 */
export function createPortalWatch({
  probe,
  now = systemClock,
  timeoutMs = 10000,
}: {
  probe: PortalProbe;
  now?: Clock;
  timeoutMs?: number;
}): PortalWatch {
  let status = INITIAL_STATUS;
  let checking: Promise<PortalStatus> | null = null;

  return {
    check() {
      checking ??= probe(timeoutMs)
        .then(
          httpStatus => isUp(httpStatus),
          () => isUp(null),
        )
        .then(up => {
          status = nextStatus(status, up, now());
          return status;
        })
        .finally(() => {
          checking = null;
        });
      return checking;
    },
    snapshot: () => status,
  };
}
