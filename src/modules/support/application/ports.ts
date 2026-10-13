import type { ErrorCode } from '@root/shared/errors/AppError';

export type ErrorReportDraft = {
  page: string;
  description: string;
  category?: ErrorCode;
  subjectCode?: string;
};

type DiagnosticReport = {
  page: string;
  description: string;
  diagnostic: {
    schemaVersion: 1;
    operation: string;
    category: ErrorCode | 'USER_REPORT';
    appVersion: string;
    parserVersion: string;
    subjectCode?: string;
    /** Evento do monitoramento de falhas ligado a este relato. */
    eventId?: string;
  };
};

export interface ErrorReporterPort {
  submit(report: DiagnosticReport): Promise<void>;
}

type ReportCategory = DiagnosticReport['diagnostic']['category'];

/**
 * Monitoramento de falhas. Recebe só a tela e a categoria do relato, nunca a
 * descrição, que pode ter dados do aluno.
 */
export interface ErrorMonitorPort {
  /** Registra o relato e devolve o id do evento, ou null se estiver desligado. */
  linkReport(report: {
    operation: string;
    category: ReportCategory;
  }): string | null;
}
