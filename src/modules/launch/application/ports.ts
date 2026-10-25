import type { LaunchTarget } from '../domain/launchTarget';

/** Aberturas do app vindas de fora (módulo nativo, Android e iOS). */
export interface LaunchSource {
  /** Destino da abertura atual; lido uma vez. */
  consume(): Promise<LaunchTarget | null>;
  /** Aberturas seguintes, com o app já em memória. */
  subscribe(listener: (target: LaunchTarget) => void): () => void;
}
