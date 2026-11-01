import type { PortalStatus } from './domain.ts';

/** Porta de entrada: a situação do portal e a consulta que a atualiza. */
export interface PortalWatch {
  /** Consulta o portal agora; consultas simultâneas dividem uma só. */
  check(): Promise<PortalStatus>;
  /** A situação da última consulta, sem consultar. */
  snapshot(): PortalStatus;
}

/**
 * Porta de saída: consulta a página inicial do portal (sem conta) e devolve
 * o status HTTP; sem resposta no tempo, rejeita.
 */
export type PortalProbe = (timeoutMs: number) => Promise<number>;
