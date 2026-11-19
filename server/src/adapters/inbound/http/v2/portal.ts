import express, { type RequestHandler, type Response } from 'express';
import { z } from 'zod';

import type { PortalAlerts } from '../../../../modules/portal/ports.ts';
import type { StudentActor } from '../../../../modules/students/ports.ts';
import type {
  PortalPushStatusResponse,
  PortalReturnAlertStatusResponse,
} from '../contract.ts';
import { body, parse, stringFor } from '../validation.ts';
import { actorOf } from './students.ts';

/** O token do APNs: hoje 32 bytes (64 dígitos hex); a Apple avisa que pode crescer. */
const APNS_TOKEN = /^[0-9a-f]{64,200}$/;

const deviceSchema = body({
  platform: z.literal('ios', { error: 'platform must be ios' }),
  token: stringFor('token')
    .trim()
    .toLowerCase()
    .regex(APNS_TOKEN, 'token must be the APNs token in hex'),
});

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

/** O aluno da sessão (a rota só chega aqui com `session`). */
const actor = (res: Response): StudentActor => actorOf(res)!;

/**
 * Os avisos do portal no iPhone em `/aouerj/v2/portal`, só com a sessão de
 * aluno: o "Avisar quando voltar" por push e o registro do cutucão da
 * verificação. Os pedidos contam no limite por aluno; as leituras, não (o
 * app as faz ao abrir).
 */
export function portalRoutes({
  portalAlerts,
  withDatabase,
  session,
  studentLimit,
}: {
  portalAlerts: PortalAlerts;
  withDatabase: RequestHandler;
  /** A sessão exigida (`requireStudentSession`). */
  session: RequestHandler;
  /** Os pedidos, por aluno, por minuto. */
  studentLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.get(
    '/portal/return-alert',
    session,
    withDatabase,
    async (req, res) => {
      const status = await portalAlerts.returnAlertStatus(actor(res));
      noStore(res).json({
        available: status.available,
        requested: status.requested,
      } satisfies PortalReturnAlertStatusResponse);
    },
  );

  routes.post(
    '/portal/return-alert',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const device = parse(deviceSchema, req.body);
      await portalAlerts.requestReturnAlert(device, actor(res));
      noStore(res).status(204).end();
    },
  );

  routes.post(
    '/portal/return-alert/cancel',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      await portalAlerts.cancelReturnAlert(actor(res));
      noStore(res).status(204).end();
    },
  );

  routes.get('/portal/push', session, withDatabase, async (req, res) => {
    const status = await portalAlerts.pushStatus(actor(res));
    noStore(res).json({
      available: status.available,
      registered: status.registered,
    } satisfies PortalPushStatusResponse);
  });

  routes.post(
    '/portal/push',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const device = parse(deviceSchema, req.body);
      await portalAlerts.registerPush(device, actor(res));
      noStore(res).status(204).end();
    },
  );

  routes.post(
    '/portal/push/cancel',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      await portalAlerts.unregisterPush(actor(res));
      noStore(res).status(204).end();
    },
  );

  return routes;
}
