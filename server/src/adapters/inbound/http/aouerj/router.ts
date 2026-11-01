import express from 'express';

import type { Mural } from '../../../../modules/mural/ports.ts';
import type { PortalWatch } from '../../../../modules/portal/ports.ts';
import type { ErrorReports } from '../../../../modules/reports/ports.ts';
import type { ScheduleGenerator } from '../../../../modules/schedules/ports.ts';
import type { Suggestions } from '../../../../modules/suggestions/ports.ts';
import type { TeacherDirectory } from '../../../../modules/teachers/ports.ts';
import { adminSession } from '../adminSession.ts';
import { adminOnly, perMinuteLimit, requireDatabase } from '../middleware.ts';
import { adminRoutes } from './admin/routes.ts';
import { muralRoutes } from './mural.ts';
import { reportRoutes } from './reports.ts';
import { statusRoutes, type DatabaseHealth, type Release } from './status.ts';
import { suggestionRoutes } from './suggestions.ts';
import { teacherRoutes } from './teachers.ts';

/** As portas de entrada que `/aouerj` usa. */
export type AoUerjServices = {
  mural: Mural;
  teachers: TeacherDirectory;
  reports: ErrorReports;
  suggestions: Suggestions;
  portal: Pick<PortalWatch, 'snapshot'>;
  /** Só a carga, para o `GET /status`. */
  schedules: Pick<ScheduleGenerator, 'load'>;
};

/**
 * As rotas em `/aouerj`, com os mesmos caminhos, métodos, status e corpos que
 * os apps publicados já usam. As gravações dividem um só limite por IP.
 */
export function createAoUerjRouter({
  basePath,
  services,
  database,
  release,
  adminToken,
  writesPerMinute,
}: {
  /** Onde este roteador está montado (`/aouerj`): o caminho do cookie. */
  basePath: string;
  services: AoUerjServices;
  database: DatabaseHealth;
  release: Release;
  adminToken: string | undefined;
  writesPerMinute: number;
}) {
  const withDatabase = requireDatabase(() => database.isReady());
  const writeLimit = perMinuteLimit(writesPerMinute);
  const session = adminToken ? adminSession(adminToken, basePath) : null;
  const admin = adminOnly(session);

  return express
    .Router()
    .use(
      statusRoutes({
        portal: services.portal,
        database,
        generator: services.schedules,
        release,
      }),
    )
    .use(muralRoutes({ mural: services.mural, withDatabase, writeLimit }))
    .use(teacherRoutes({ teachers: services.teachers, withDatabase }))
    .use(
      reportRoutes({
        reports: services.reports,
        withDatabase,
        writeLimit,
        adminOnly: admin,
      }),
    )
    .use(
      suggestionRoutes({
        suggestions: services.suggestions,
        withDatabase,
        writeLimit,
        adminOnly: admin,
      }),
    )
    .use(
      adminRoutes({
        reports: services.reports,
        suggestions: services.suggestions,
        session,
        isDatabaseReady: () => database.isReady(),
      }),
    );
}
