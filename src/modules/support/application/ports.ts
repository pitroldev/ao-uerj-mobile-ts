import type { ErrorCode } from '@root/shared/errors/AppError';

export type ErrorReportDraft = {
  page: string;
  description: string;
  category?: ErrorCode;
  subjectCode?: string;
};

export type DiagnosticReport = {
  page: string;
  description: string;
  diagnostic: {
    schemaVersion: 1;
    operation: string;
    category: ErrorCode | 'USER_REPORT';
    appVersion: string;
    parserVersion: string;
    subjectCode?: string;
  };
};

export interface ErrorReporterPort {
  submit(report: DiagnosticReport): Promise<void>;
}
