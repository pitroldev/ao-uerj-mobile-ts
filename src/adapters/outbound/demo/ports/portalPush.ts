import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalReturnServerPort,
  PushRegistrationServerPort,
} from '@root/modules/notifications/application/ports';

const unavailable = async () => {
  throw new AppError('SERVICE_UNAVAILABLE');
};

/**
 * "Avisar quando voltar" por push na demo: sem servidor, não há push, e o
 * pedido fica com a tarefa do aparelho (que, sem portal, nunca avisa).
 */
export function createDemoPortalReturn(): PortalReturnServerPort {
  return {
    status: async () => ({ available: false, requested: false }),
    request: unavailable,
    cancel: async () => undefined,
  };
}

/** O cutucão da verificação na demo: sem servidor, nenhum registro. */
export function createDemoPortalPush(): PushRegistrationServerPort {
  return {
    status: async () => ({ available: false, registered: false }),
    register: unavailable,
    unregister: async () => undefined,
  };
}
