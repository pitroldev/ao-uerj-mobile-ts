import express from 'express';

import type { PortalStatus } from '../../../../modules/portal/domain.ts';
import type { PortalWatch } from '../../../../modules/portal/ports.ts';
import type { ScheduleGenerator } from '../../../../modules/schedules/ports.ts';
import type {
  HealthResponse,
  PortalStatusResponse,
  StatusResponse,
} from '../contract.ts';

/** O que o HTTP precisa saber do banco. */
export type DatabaseHealth = { isReady(): boolean; status(): string };

/** A versão no ar, que a implantação informa. */
export type Release = {
  commit: string | null;
  color: 'blue' | 'green' | null;
};

/** A situação do portal com as datas em ISO. */
export function toPortalStatusResponse({
  state,
  since,
  checkedAt,
}: PortalStatus): PortalStatusResponse {
  const iso = (value: number | null) =>
    value === null ? null : new Date(value).toISOString();
  return { state, since: iso(since), checkedAt: iso(checkedAt) };
}

/**
 * `GET /portal-status`, `GET /health` e `GET /status`: sem dado de aluno e
 * sem depender do banco para responder.
 */
export function statusRoutes({
  portal,
  database,
  generator,
  release,
}: {
  portal: Pick<PortalWatch, 'snapshot'>;
  database: DatabaseHealth;
  generator: Pick<ScheduleGenerator, 'load'>;
  release: Release;
}) {
  const routes = express.Router();

  // o app consulta durante uma queda do portal
  routes.get('/portal-status', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(toPortalStatusResponse(portal.snapshot()));
  });

  routes.get('/health', (req, res) => {
    res.json({
      online: true,
      database: database.status(),
      timestamp: new Date().toISOString(),
    } satisfies HealthResponse);
  });

  // para consultar a versão no ar; 503 enquanto o banco não está conectado
  routes.get('/status', (req, res) => {
    const uptimeSeconds = Math.round(process.uptime());
    const now = Date.now();
    res.set('Cache-Control', 'no-store');
    res.status(database.isReady() ? 200 : 503).json({
      status: database.isReady() ? 'ok' : 'degraded',
      release: {
        ...release,
        startedAt: new Date(now - uptimeSeconds * 1000).toISOString(),
        // sem a versão do Node: ela só serviria para mirar uma falha conhecida
        uptimeSeconds,
      },
      database: database.status(),
      portal: toPortalStatusResponse(portal.snapshot()),
      generator: generator.load(),
      timestamp: new Date(now).toISOString(),
    } satisfies StatusResponse);
  });

  return routes;
}
