import NativeAppNotifications, {
  type Spec,
} from '@root/specs/NativeAppNotifications';

/** Uma rodada do BGTaskScheduler: os modos que venceram, na ordem. */
export type BackgroundRound = { id: string; modes: string[] };

export type BackgroundRounds = {
  /**
   * Assina as rodadas e as expirações e avisa o aparelho que o JS está
   * pronto: as rodadas guardadas desde a abertura chegam logo. Devolve o
   * cancelamento.
   */
  listen(handlers: {
    start: (round: BackgroundRound) => void;
    expire: (id: string) => void;
  }): () => void;
  /** Encerra a rodada; o iOS pode suspender o app logo depois. */
  finish(id: string, success: boolean): Promise<void>;
};

/**
 * As rodadas da verificação em segundo plano no iPhone, pelo módulo nativo
 * dos avisos (o BGTaskScheduler fica no AppDelegate.swift). Com o app
 * fechado, o iOS abre o processo sem tela, o React Native começa sem janela
 * e a rodada espera o JS assinar. `null` onde o módulo não existe.
 */
export function createNativeBackgroundRounds(
  module: Spec | null | undefined = NativeAppNotifications,
): BackgroundRounds | null {
  if (!module) return null;
  return {
    listen({ start, expire }) {
      const started = module.onBackgroundTask(round => {
        // só os textos viram modo: o que vem do nativo não passa pelos tipos
        const raw: unknown = round.modes;
        const modes = Array.isArray(raw)
          ? raw.filter((mode): mode is string => typeof mode === 'string')
          : [];
        if (typeof round.id === 'string') start({ id: round.id, modes });
      });
      const expired = module.onBackgroundTaskExpired(id => expire(id));
      // depois das assinaturas: antes delas, o evento se perderia
      void module.listenBackgroundTasks().catch(() => undefined);
      return () => {
        started.remove();
        expired.remove();
      };
    },
    finish: (id, success) => module.setTaskCompleted(id, success),
  };
}
