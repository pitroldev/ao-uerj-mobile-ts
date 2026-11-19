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

/**
 * Os relatos que são o mesmo problema (a mesma `reportSignature`), para a
 * triagem resolver de uma vez.
 */
export type ReportGroup = {
  /** Fixo enquanto a assinatura for a mesma: vai na URL. */
  key: string;
  page: string;
  /** O diagnóstico do mais novo que tem um; `null` sem nenhum (a 1.x). */
  diagnostic: Diagnostic | null;
  /** Os mais novos primeiro. */
  reports: ReviewedReport[];
  first: Date;
  last: Date;
  /** Quantos alunos identificados diferentes e quantos relatos sem o aluno. */
  students: number;
  anonymous: number;
  /** As versões do app, da com mais relatos à com menos. */
  versions: Array<{ version: string; reports: number }>;
  /** As OTAs (o id) e quantos relatos com cada uma. */
  updates: Array<{ id: string; reports: number }>;
  /** O último resolvido do grupo (só nos resolvidos). */
  resolvedAt: Date | null;
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
  /**
   * Os grupos dos abertos (os maiores primeiro) ou dos resolvidos (os
   * resolvidos por último primeiro), de até `GROUP_LIMIT` relatos.
   */
  groups(status: 'open' | 'resolved'): Promise<ReportGroup[]>;
  /**
   * Resolve (ou reabre) os relatos de uma vez, todos com a mesma hora:
   * quantos mudaram e a hora (`null` ao reabrir).
   */
  setResolvedMany(
    ids: readonly string[],
    resolved: boolean,
  ): Promise<{ changed: number; at: Date | null }>;
  /** Os relatos do aluno, os mais novos primeiro (até 50). */
  byStudent(studentId: string): Promise<ErrorReport[]>;
  /** Os criados desde `since`, os mais novos primeiro (os números da triagem). */
  createdSince(since: Date): Promise<ErrorReport[]>;
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
  listByStudent(studentId: string, limit: number): Promise<ErrorReport[]>;
  listCreatedSince(since: Date, limit: number): Promise<ErrorReport[]>;
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
