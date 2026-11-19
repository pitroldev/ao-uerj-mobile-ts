import { createHash } from 'node:crypto';

import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  GROUP_LIMIT,
  parseDiagnostic,
  RECENT_REPORTS,
  reportSignature,
  REVIEW_LIMIT,
  type Diagnostic,
  type ErrorReport,
} from './domain.ts';
import type {
  AttachmentStore,
  AttachmentView,
  ErrorReportRepository,
  ErrorReports,
  ReportGroup,
  ReviewedReport,
} from './ports.ts';

/** O diagnóstico do relato (o primeiro anexo que é um); `null` sem nenhum. */
export const diagnosticOf = (report: ReviewedReport): Diagnostic | null =>
  report.attachments.find(attachment => attachment.kind === 'diagnostic')
    ?.diagnostic ?? null;

/** Quantos de cada valor, do mais frequente ao menos. */
function tally(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** A chave de um grupo na URL: fixa enquanto a assinatura for a mesma. */
export const groupKey = (signature: string) =>
  createHash('sha256').update(signature).digest('hex').slice(0, 12);

/** Junta os relatos (os mais novos primeiro) pela assinatura. */
export function groupReports(
  reports: readonly ReviewedReport[],
): ReportGroup[] {
  const groups = new Map<string, ReviewedReport[]>();
  for (const report of reports) {
    const signature = reportSignature(report.page, diagnosticOf(report));
    const list = groups.get(signature);
    if (list) list.push(report);
    else groups.set(signature, [report]);
  }
  return [...groups].map(([signature, list]) => {
    const diagnostics = list.map(diagnosticOf);
    const identified = new Set(
      list.flatMap(report => (report.studentId ? [report.studentId] : [])),
    );
    const resolved = list.flatMap(report =>
      report.resolvedAt ? [report.resolvedAt.getTime()] : [],
    );
    return {
      key: groupKey(signature),
      page: list[0].page,
      diagnostic: diagnostics.find(item => item !== null) ?? null,
      reports: list,
      first: list[list.length - 1].createdAt,
      last: list[0].createdAt,
      students: identified.size,
      anonymous: list.filter(report => !report.studentId).length,
      versions: tally(
        diagnostics.flatMap(item => (item ? [item.appVersion] : [])),
      ).map(([version, count]) => ({ version, reports: count })),
      updates: tally(
        diagnostics.flatMap(item => (item?.updateId ? [item.updateId] : [])),
      ).map(([id, count]) => ({ id, reports: count })),
      resolvedAt: resolved.length ? new Date(Math.max(...resolved)) : null,
    };
  });
}

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

    async groups(status) {
      const found = await reports.listForReview({ status }, GROUP_LIMIT);
      const groups = groupReports(
        await Promise.all(found.reports.map(withAttachments)),
      );
      return status === 'open'
        ? groups.sort(
            (a, b) =>
              b.reports.length - a.reports.length ||
              b.last.getTime() - a.last.getTime(),
          )
        : groups.sort(
            (a, b) =>
              (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0),
          );
    },

    async setResolvedMany(ids, resolved) {
      const at = resolved ? new Date(now()) : null;
      let changed = 0;
      for (const id of new Set(ids))
        if (await reports.setResolvedAt(id, at)) changed += 1;
      return { changed, at };
    },

    byStudent: studentId => reports.listByStudent(studentId, 50),
    createdSince: since => reports.listCreatedSince(since, GROUP_LIMIT),

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
