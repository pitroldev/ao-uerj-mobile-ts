import type { AppServices } from '../composition/createAppServices';

/** Nome da tarefa sem tela (o PortalCheckWorker do Android usa o mesmo). */
export const PORTAL_CHECK_TASK = 'AoUerjPortalCheck';

/** Dados do PortalCheckWorker: `mode: 'return'` no teste de "Avisar quando voltar". */
type TaskData = { mode?: string } | null;

/** Prazo da verificação inteira; o Android encerra a tarefa logo depois. */
const DEADLINE = 3 * 60 * 1000;

/**
 * Verificação de avisos chamada pelo WorkManager com o app fora da tela.
 * Antes de qualquer acesso à rede, decide com o que está no aparelho
 * (horário, pausa, avisos ligados da conta salva, cópia salva do aviso
 * remoto); só então busca o aviso remoto, que pode desligar os avisos,
 * restaura a conta (o login da rodada) e consulta as páginas dos avisos
 * ligados.
 */
export function createPortalCheckTask(services: () => AppServices) {
  const verify = async (data?: TaskData) => {
    const current = services();
    // "Avisar quando voltar": só o teste leve do portal, sem login
    if (data?.mode === 'return') {
      await current.notifications.portalReturn
        ?.checkInBackground()
        .catch(() => undefined);
      return;
    }
    const check = current.notifications.portalCheck;
    if (!check) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEADLINE);
    try {
      // à noite, na pausa ou com os avisos desligados, nem o aviso remoto é
      // buscado: vale a cópia salva
      await current.delivery.status.load();
      if (!(await check.canRun())) return;
      await current.delivery.status.refresh();
      if (!(await check.canRun())) return;
      // num runtime novo, a restauração da conta é o login da rodada
      const restoring = current.identity.getSnapshot().status === 'restoring';
      await current.initialize();
      const { error, errorCode } = current.identity.getSnapshot();
      if (restoring && error) {
        // a restauração não entrou no portal: as páginas entrariam de novo,
        // então fica só o resultado
        await check.signInFailed(errorCode ?? null);
        return;
      }
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
  return (data?: TaskData) => {
    running ??= verify(data).finally(() => {
      running = null;
    });
    return running;
  };
}
