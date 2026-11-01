import type { GenerationRequest, GenerationResult } from './domain/model.ts';

export type SolveOptions = {
  /** Quem pediu desistiu (a conexão fechou): a busca para e rejeita. */
  signal?: AbortSignal;
};

/** Buscas rodando e esperando a vez. */
export type GeneratorLoad = { running: number; queued: number };

/** Porta de entrada: o gerador de grades. */
export interface ScheduleGenerator {
  generate(
    request: GenerationRequest,
    options?: SolveOptions,
  ): Promise<GenerationResult>;
  load(): GeneratorLoad;
}

/**
 * Porta de saída: onde a busca roda. Ela ocupa a CPU por até alguns
 * segundos; na produção, fora da thread que atende o HTTP.
 */
export interface ScheduleSolver {
  solve(
    request: GenerationRequest,
    options?: SolveOptions,
  ): Promise<GenerationResult>;
  load(): GeneratorLoad;
  /** Encerra as buscas em andamento (no desligamento). */
  close?(): Promise<void>;
}
