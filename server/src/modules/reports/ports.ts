import type { ErrorReport, NewErrorReport } from './domain.ts';

/** Porta de entrada: os relatos de erro. */
export interface ErrorReports {
  /** Grava os anexos e depois o relato; se o relato falha, os anexos saem. */
  submit(report: NewErrorReport): Promise<ErrorReport>;
  /** Os mais recentes, para a administração. */
  listRecent(): Promise<ErrorReport[]>;
}

/** Porta de saída: onde os relatos ficam. */
export interface ErrorReportRepository {
  create(
    report: Omit<ErrorReport, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ErrorReport>;
  listRecent(limit: number): Promise<ErrorReport[]>;
}

/** Porta de saída: onde os anexos ficam. Uma gravação que falha não deixa nada. */
export interface AttachmentStore {
  /** Grava os anexos e devolve um id para cada um. */
  save(page: string, documents: readonly string[]): Promise<string[]>;
  /** Apaga os anexos gravados (relato que não chegou ao banco). */
  discard(page: string, ids: readonly string[]): Promise<void>;
}
