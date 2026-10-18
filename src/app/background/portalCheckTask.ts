import type { AppServices } from '../composition/createAppServices';

/** Nome da tarefa sem tela (o PortalCheckWorker do Android usa o mesmo). */
export const PORTAL_CHECK_TASK = 'AoUerjPortalCheck';

/** Prazo da verificação inteira; o Android encerra a tarefa logo depois. */
const DEADLINE = 3 * 60 * 1000;

/**
 * Verificação de avisos chamada pelo WorkManager com o app fora da tela.
 * Antes de qualquer acesso ao portal, decide com o que está no aparelho
 * (horário, pausa, avisos ligados da conta salva) e com o aviso remoto, que
 * pode desligar os avisos; só então restaura a conta (uma autenticação) e
 * consulta as páginas dos avisos ligados.
 */
export function createPortalCheckTask(services: () => AppServices) {
  const verify = async () => {
    const current = services();
    const check = current.notifications.portalCheck;
    if (!check) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEADLINE);
    try {
      await current.delivery.status.start();
      // à noite ou na pausa, nem o aviso remoto é buscado
      if (!(await check.canRun())) return;
      await current.delivery.status.refresh();
      if (!(await check.canRun())) return;
      await current.initialize();
      await check.run({ signal: controller.signal });
    } catch {
      // o próximo ciclo tenta de novo; nada a mostrar sem tela
    } finally {
      clearTimeout(timer);
      await current.flushCache().catch(() => undefined);
    }
  };
  // Uma verificação por vez: o Android pode parar a tarefa (sem rede, por
  // exemplo) com o JS ainda consultando, e uma nova chamada esperaria a
  // anterior em vez de repetir as consultas e os avisos.
  let running: Promise<void> | null = null;
  return () => {
    running ??= verify().finally(() => {
      running = null;
    });
    return running;
  };
}
