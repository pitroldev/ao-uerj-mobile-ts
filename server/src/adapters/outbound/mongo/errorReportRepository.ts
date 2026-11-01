import type { ErrorReport } from '../../../modules/reports/domain.ts';
import type { ErrorReportRepository } from '../../../modules/reports/ports.ts';
import { guarded, storedDate, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredReport = Stored & {
  page: string;
  description?: string;
  email?: string;
  filesID?: string[];
};

export function toReport(doc: StoredReport): ErrorReport {
  return {
    id: String(doc._id),
    page: doc.page,
    description: doc.description,
    email: doc.email,
    attachmentIds: doc.filesID ?? [],
    createdAt: storedDate(doc.createdAt),
    updatedAt: storedDate(doc.updatedAt),
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
  };
}
