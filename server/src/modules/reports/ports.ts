import type {
  Diagnostic,
  ErrorReport,
  NewErrorReport,
  ReviewFilter,
  ReviewSummary,
} from './domain.ts';

/** Um anexo como a triagem o mostra. */
export type AttachmentView =
  | { id: string; kind: 'diagnostic'; diagnostic: Diagnostic }
  | { id: string; kind: 'page'; bytes: number }
  | { id: string; kind: 'missing' };

/** Um relato na triagem, com os anexos já abertos. */
export type ReviewedReport = ErrorReport & { attachments: AttachmentView[] };

/** O que a página de triagem mostra. */
export type Review = {
  summary: ReviewSummary;
  reports: ReviewedReport[];
  /** Quantos relatos o recorte tem (a página mostra até `REVIEW_LIMIT`). */
  total: number;
};

/** O conteúdo de um anexo: o diagnóstico ou a página do portal (HTML). */
export type AttachmentContent =
  | {
      kind: 'diagnostic';
      diagnostic: Diagnostic;
      /** O JSON como chegou. */
      raw: string;
      report: ErrorReport;
    }
  | { kind: 'page'; html: string; report: ErrorReport };

/** Porta de entrada: os relatos de erro. */
export interface ErrorReports {
  /** Grava os anexos e depois o relato; se o relato falha, os anexos saem. */
  submit(report: NewErrorReport): Promise<ErrorReport>;
  /** Os mais recentes, para a administração. */
  listRecent(): Promise<ErrorReport[]>;
  /** A triagem: o resumo por tela e os relatos do recorte. */
  review(filter: ReviewFilter): Promise<Review>;
  /** Só o resumo por tela (a contagem das abas). */
  summarize(): Promise<ReviewSummary>;
  /** Dá o relato como resolvido (ou o reabre); `null` se ele não existe. */
  setResolved(id: string, resolved: boolean): Promise<ErrorReport | null>;
  /** Um anexo do relato; `null` se o relato ou o anexo não existem. */
  attachment(
    id: string,
    attachmentId: string,
  ): Promise<AttachmentContent | null>;
}

/** Porta de saída: onde os relatos ficam. */
export interface ErrorReportRepository {
  create(
    report: Omit<ErrorReport, 'id' | 'resolvedAt' | 'createdAt' | 'updatedAt'>,
  ): Promise<ErrorReport>;
  listRecent(limit: number): Promise<ErrorReport[]>;
  findById(id: string): Promise<ErrorReport | null>;
  /** Os do recorte, os mais recentes primeiro, e quantos o recorte tem. */
  listForReview(
    filter: ReviewFilter,
    limit: number,
  ): Promise<{ reports: ErrorReport[]; total: number }>;
  summarize(): Promise<ReviewSummary>;
  setResolvedAt(id: string, at: Date | null): Promise<ErrorReport | null>;
}

/** Porta de saída: onde os anexos ficam. Uma gravação que falha não deixa nada. */
export interface AttachmentStore {
  /** Grava os anexos e devolve um id para cada um. */
  save(page: string, documents: readonly string[]): Promise<string[]>;
  /** Apaga os anexos gravados (relato que não chegou ao banco). */
  discard(page: string, ids: readonly string[]): Promise<void>;
  /**
   * Lê um anexo: o tamanho e o texto, só até `maxBytes` se pedido (a triagem
   * só precisa saber se é um diagnóstico). `null` se ele não existe.
   */
  read(
    page: string,
    id: string,
    options?: { maxBytes?: number },
  ): Promise<{ bytes: number; text: string } | null>;
}
