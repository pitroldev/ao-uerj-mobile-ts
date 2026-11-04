import {
  UNKNOWN_PAGE,
  type ErrorReport,
  type ReviewFilter,
  type ReviewSummary,
} from '../../../modules/reports/domain.ts';
import type { ErrorReportRepository } from '../../../modules/reports/ports.ts';
import { guarded, storedDate, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredReport = Stored & {
  /** Os relatos mais antigos podem não ter a tela. */
  page?: string | null;
  description?: string;
  email?: string;
  filesID?: string[];
  resolvedAt?: Date | null;
  studentId?: string | null;
};

export function toReport(doc: StoredReport): ErrorReport {
  return {
    id: String(doc._id),
    page: doc.page || UNKNOWN_PAGE,
    description: doc.description,
    email: doc.email,
    studentId: doc.studentId ?? null,
    attachmentIds: doc.filesID ?? [],
    // os relatos de antes da triagem não têm o campo: estão abertos
    resolvedAt: doc.resolvedAt ?? null,
    createdAt: storedDate(doc.createdAt),
    updatedAt: storedDate(doc.updatedAt),
  };
}

/** Um id do Mongo; outro texto não chega a virar consulta (nem um CastError). */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * O recorte em consulta: `resolvedAt: null` pega também quem não tem o
 * campo, e a tela desconhecida, quem não tem a tela (`null` pega o ausente).
 */
function reviewQuery({ status, page }: ReviewFilter) {
  let pageQuery = {};
  if (page === UNKNOWN_PAGE)
    pageQuery = { page: { $in: [null, '', UNKNOWN_PAGE] } };
  else if (page !== undefined) pageQuery = { page };
  return {
    ...(status === 'open' ? { resolvedAt: null } : {}),
    ...(status === 'resolved' ? { resolvedAt: { $ne: null } } : {}),
    ...pageQuery,
  };
}

export function createErrorReportRepository(
  model: Models['errorReports'],
): ErrorReportRepository {
  return {
    create: report =>
      guarded(async () => {
        const created = await model.create({
          page: report.page,
          description: report.description,
          email: report.email,
          filesID: report.attachmentIds,
          studentId: report.studentId ?? null,
        });
        return toReport(created.toObject<StoredReport>());
      }),
    listRecent: limit =>
      guarded(async () => {
        const found = await model
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<StoredReport[]>();
        return found.map(toReport);
      }),
    findById: id =>
      guarded(async () => {
        if (!OBJECT_ID.test(id)) return null;
        const found = await model.findById(id).lean<StoredReport>();
        return found ? toReport(found) : null;
      }),
    listForReview: (filter, limit) =>
      guarded(async () => {
        const query = reviewQuery(filter);
        const [found, total] = await Promise.all([
          model
            .find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit)
            .lean<StoredReport[]>(),
          model.countDocuments(query),
        ]);
        return { reports: found.map(toReport), total };
      }),
    summarize: () =>
      guarded(async () => {
        const rows = await model.aggregate<{
          _id: { page: string | null; resolved: boolean };
          count: number;
        }>([
          {
            $group: {
              _id: {
                page: '$page',
                resolved: {
                  $ne: [{ $ifNull: ['$resolvedAt', null] }, null],
                },
              },
              count: { $sum: 1 },
            },
          },
        ]);
        const pages = new Map<string, { open: number; resolved: number }>();
        for (const { _id, count } of rows) {
          // sem a tela (ausente, nula ou vazia): uma linha só
          const page = _id.page || UNKNOWN_PAGE;
          const entry = pages.get(page) ?? { open: 0, resolved: 0 };
          if (_id.resolved) entry.resolved += count;
          else entry.open += count;
          pages.set(page, entry);
        }
        const list = [...pages].map(([page, counts]) => ({ page, ...counts }));
        return {
          open: list.reduce((sum, item) => sum + item.open, 0),
          resolved: list.reduce((sum, item) => sum + item.resolved, 0),
          // as telas com mais abertos primeiro
          pages: list.sort(
            (a, b) =>
              b.open - a.open ||
              b.resolved - a.resolved ||
              a.page.localeCompare(b.page, 'pt-BR'),
          ),
        } satisfies ReviewSummary;
      }),
    setResolvedAt: (id, at) =>
      guarded(async () => {
        if (!OBJECT_ID.test(id)) return null;
        const updated = await model
          .findByIdAndUpdate(
            id,
            { resolvedAt: at },
            { returnDocument: 'after' },
          )
          .lean<StoredReport>();
        return updated ? toReport(updated) : null;
      }),
  };
}
