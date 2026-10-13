import { AppError } from '@root/shared/errors/AppError';
import type {
  ErrorMonitorPort,
  ErrorReportDraft,
  ErrorReporterPort,
} from './ports';
import { sanitizeDescription } from './sanitizeDescription';

type ReporterAccount = { scope: string; name: string; matricula: string };

export class SubmitErrorReport {
  constructor(
    private readonly reporter: ErrorReporterPort,
    private readonly version: { appVersion: string; parserVersion: string },
    private readonly currentAccount: () => ReporterAccount | null,
    private readonly monitor?: ErrorMonitorPort,
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
    const category = draft.category ?? 'USER_REPORT';
    // Antes do envio, para o id ir junto no relato. Uma nova tentativa depois
    // de falha de rede registra outro evento.
    const eventId = this.monitor?.linkReport({ operation, category });
    await this.reporter.submit({
      page: operation,
      description,
      diagnostic: {
        schemaVersion: 1,
        operation,
        category,
        ...this.version,
        ...(subjectCode ? { subjectCode } : {}),
        ...(eventId ? { eventId } : {}),
      },
    });
    if (this.currentAccount()?.scope !== account.scope)
      throw new AppError('CANCELLED');
  };
}
