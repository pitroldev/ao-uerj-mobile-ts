import type { BackgroundRounds } from '@root/adapters/outbound/native/NativeBackgroundRounds';
import type { PortalCheckTask } from './portalCheckTask';

/**
 * O iOS dá cerca de 30 segundos a cada rodada, contando a abertura do app: o
 * JS para antes, com o que já leu.
 */
export const IOS_DEADLINE = 25 * 1000;

/**
 * As rodadas do iPhone (BGTaskScheduler): os modos que venceram, um depois do
 * outro, pela mesma tarefa do Android, dentro do prazo do iOS. O fim do
 * prazo ou a expiração avisada pelo iOS param as consultas (os avisos do que
 * já foi lido saem); depois, a rodada é encerrada no aparelho.
 */
export function runBackgroundRounds(
  rounds: BackgroundRounds,
  task: PortalCheckTask,
  deadline = IOS_DEADLINE,
): () => void {
  const active = new Map<string, AbortController>();
  return rounds.listen({
    start(round) {
      if (active.has(round.id)) return;
      const controller = new AbortController();
      active.set(round.id, controller);
      const timer = setTimeout(() => controller.abort(), deadline);
      const run = async () => {
        for (const mode of round.modes) {
          if (controller.signal.aborted) return;
          // `check` é a verificação no portal, a tarefa sem modo do Android
          await task(mode === 'check' ? null : { mode }, controller.signal);
        }
      };
      void run()
        .catch(() => undefined)
        .then(() => {
          clearTimeout(timer);
          active.delete(round.id);
          return rounds.finish(round.id, !controller.signal.aborted);
        })
        .catch(() => undefined);
    },
    expire(id) {
      active.get(id)?.abort();
    },
  });
}
