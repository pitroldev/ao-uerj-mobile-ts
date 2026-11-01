import type { PortalProbe } from '../../../modules/portal/ports.ts';

export const ALUNO_ONLINE_URL = 'https://www.alunoonline.uerj.br/';

/**
 * Um GET na página inicial do Aluno Online, sem seguir redirecionamentos e
 * sem ler o corpo: só o status importa.
 */
export function createPortalProbe(url = ALUNO_ONLINE_URL): PortalProbe {
  return async timeoutMs => {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    return response.status;
  };
}
