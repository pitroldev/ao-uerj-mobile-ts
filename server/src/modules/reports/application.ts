import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  parseDiagnostic,
  RECENT_REPORTS,
  REVIEW_LIMIT,
  type ErrorReport,
} from './domain.ts';
import type {
  AttachmentStore,
  AttachmentView,
  ErrorReportRepository,
  ErrorReports,
  ReviewedReport,
} from './ports.ts';

/** Um diagnóstico cabe nisto; um anexo maior é a página do portal (1.x). */
const DIAGNOSTIC_BYTES = 16 * 1024;

export function createErrorReports(
  reports: ErrorReportRepository,
  attachments: AttachmentStore,
  { now = systemClock }: { now?: Clock } = {},
): ErrorReports {
  /** Os anexos do relato, lidos só o bastante para saber o que são. */
  async function withAttachments(report: ErrorReport): Promise<ReviewedReport> {
    const views = await Promise.all(
      report.attachmentIds.map(async (id): Promise<AttachmentView> => {
        const found = await attachments
          .read(report.page, id, { maxBytes: DIAGNOSTIC_BYTES })
          // um anexo ilegível não derruba a página inteira
          .catch(() => null);
        if (!found) return { id, kind: 'missing' };
        const diagnostic =
          found.bytes <= DIAGNOSTIC_BYTES ? parseDiagnostic(found.text) : null;
        return diagnostic
          ? { id, kind: 'diagnostic', diagnostic }
          : { id, kind: 'page', bytes: found.bytes };
      }),
    );
    return { ...report, attachments: views };
  }

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

    async review(filter) {
      const [summary, found] = await Promise.all([
        reports.summarize(),
        reports.listForReview(filter, REVIEW_LIMIT),
      ]);
      return {
        summary,
        total: found.total,
        reports: await Promise.all(found.reports.map(withAttachments)),
      };
    },

    summarize: () => reports.summarize(),

    setResolved: (id, resolved) =>
      reports.setResolvedAt(id, resolved ? new Date(now()) : null),

    async attachment(id, attachmentId) {
      const report = await reports.findById(id);
      // só um anexo deste relato: o id não abre outro arquivo da pasta
      if (!report || !report.attachmentIds.includes(attachmentId)) return null;
      const found = await attachments.read(report.page, attachmentId);
      if (!found) return null;
      const diagnostic = parseDiagnostic(found.text);
      return diagnostic
        ? { kind: 'diagnostic', diagnostic, raw: found.text, report }
        : { kind: 'page', html: found.text, report };
    },
  };
}
