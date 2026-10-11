import { AppError } from '@root/shared/errors/AppError';
import type { ErrorReportDraft, ErrorReporterPort } from './ports';
import { sanitizeDescription } from './sanitizeDescription';

type ReporterAccount = { scope: string; name: string; matricula: string };

export class SubmitErrorReport {
  constructor(
    private readonly reporter: ErrorReporterPort,
    private readonly version: { appVersion: string; parserVersion: string },
    private readonly currentAccount: () => ReporterAccount | null,
  ) {}

  execute = async (draft: ErrorReportDraft): Promise<void> => {
    const account = this.currentAccount();
    if (!account) throw new AppError('NOT_LOGGED_IN');
    if (!draft.page.trim() || !draft.description.trim())
      throw new AppError('INVALID_INPUT');
    const personalValues = [account.name, account.matricula];
    const operation = sanitizeDescription(draft.page, personalValues).slice(
      0,
      100,
    );
    const description = sanitizeDescription(draft.description, personalValues);
    if (!operation || !description) throw new AppError('INVALID_INPUT');
    const subjectCode = draft.subjectCode?.trim().toUpperCase();
    if (subjectCode && !/^[A-Z][A-Z0-9]{1,7}-\d{3,8}$/.test(subjectCode))
      throw new AppError('INVALID_INPUT');
    await this.reporter.submit({
      page: operation,
      description,
      diagnostic: {
        schemaVersion: 1,
        operation,
        category: draft.category ?? 'USER_REPORT',
        ...this.version,
        ...(subjectCode ? { subjectCode } : {}),
      },
    });
    if (this.currentAccount()?.scope !== account.scope)
      throw new AppError('CANCELLED');
  };
}
