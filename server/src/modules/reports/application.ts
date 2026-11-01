import { RECENT_REPORTS } from './domain.ts';
import type {
  AttachmentStore,
  ErrorReportRepository,
  ErrorReports,
} from './ports.ts';

export function createErrorReports(
  reports: ErrorReportRepository,
  attachments: AttachmentStore,
): ErrorReports {
  return {
    // anexos e relato não estão numa transação: um relato que falha desfaz
    // os anexos (a compensação)
    async submit({ attachments: documents, ...report }) {
      const attachmentIds = await attachments.save(report.page, documents);
      try {
        return await reports.create({ ...report, attachmentIds });
      } catch (err) {
        await attachments
          .discard(report.page, attachmentIds)
          .catch(() => undefined);
        throw err;
      }
    },
    listRecent: () => reports.listRecent(RECENT_REPORTS),
  };
}
