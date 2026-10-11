import type { ErrorReportDraft } from '@root/modules/support/application/ports';

export type ReportStepProps = {
  body: ErrorReportDraft;
  nextStep: (updates: Partial<ErrorReportDraft>) => void;
};
