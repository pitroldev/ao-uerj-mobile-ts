import express, { type RequestHandler } from 'express';
import { z } from 'zod';

import {
  REPORT_LIMITS,
  type ErrorReport,
  type NewErrorReport,
} from '../../../../modules/reports/domain.ts';
import type { ErrorReports } from '../../../../modules/reports/ports.ts';
import type {
  ErrorReportListResponse,
  ErrorReportRecord,
  OkResponse,
} from '../contract.ts';
import {
  body,
  contactEmail,
  optionalText,
  parse,
  requiredText,
} from '../validation.ts';

const errorReportSchema = body({
  page: requiredText('page', { max: REPORT_LIMITS.page }),
  description: optionalText('description', REPORT_LIMITS.description),
  email: contactEmail(REPORT_LIMITS.email),
  html: z.preprocess(
    value => value ?? [],
    z
      .array(z.string({ error: 'each html document must be a string' }), {
        error: 'html must be an array',
      })
      .max(
        REPORT_LIMITS.attachments,
        `html must contain at most ${REPORT_LIMITS.attachments} documents`,
      ),
  ),
}).transform(({ html, ...report }): NewErrorReport => ({
  ...report,
  attachments: html,
}));

export function toReportRecord(report: ErrorReport): ErrorReportRecord {
  return {
    _id: report.id,
    page: report.page,
    description: report.description,
    email: report.email,
    filesID: report.attachmentIds,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

/** `POST /reportError` e a listagem de administração, `GET /reportError`. */
export function reportRoutes({
  reports,
  withDatabase,
  writeLimit,
  adminOnly,
}: {
  reports: ErrorReports;
  withDatabase: RequestHandler;
  writeLimit: RequestHandler;
  adminOnly: RequestHandler;
}) {
  const routes = express.Router();

  routes.post('/reportError', writeLimit, withDatabase, async (req, res) => {
    await reports.submit(parse(errorReportSchema, req.body));
    res.json({ status: 'ok' } satisfies OkResponse);
  });

  // traz e-mails: o token é conferido antes do banco
  routes.get('/reportError', adminOnly, withDatabase, async (req, res) => {
    const recent = await reports.listRecent();
    res.json({
      reports: recent.map(toReportRecord),
    } satisfies ErrorReportListResponse);
  });

  return routes;
}
