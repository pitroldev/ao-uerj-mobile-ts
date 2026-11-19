import express, { type RequestHandler, type Response } from 'express';
import { z } from 'zod';

import {
  CALL_KINDS,
  CALL_WATCH_SEEN_LIMIT,
  type CallWatchView,
} from '../../../../modules/companion/domain.ts';
import type { Companion } from '../../../../modules/companion/ports.ts';
import type { StudentActor } from '../../../../modules/students/ports.ts';
import type {
  CompanionWatchResponse,
  CompanionWatchStatusResponse,
  CompanionWatchView,
} from '../contract.ts';
import { body, parse, stringFor } from '../validation.ts';
import { actorOf } from './students.ts';

/** O token do APNs: hoje 32 bytes (64 dígitos hex); a Apple avisa que pode crescer. */
const APNS_TOKEN = /^[0-9a-f]{64,200}$/;

const watchSchema = body({
  kind: z.enum(CALL_KINDS, {
    error: issue =>
      issue.input === undefined
        ? 'kind is required'
        : `kind must be one of ${CALL_KINDS.join(', ')}`,
  }),
  until: stringFor('until')
    .refine(value => !Number.isNaN(Date.parse(value)), 'until must be a date')
    .transform(value => new Date(value)),
  seen: z
    .array(stringFor('seen[]').max(64, 'seen[] is too long'), {
      error: 'seen must be an array',
    })
    .max(
      CALL_WATCH_SEEN_LIMIT,
      `seen must contain at most ${CALL_WATCH_SEEN_LIMIT} ids`,
    ),
  push: z.object(
    {
      platform: z.literal('ios', { error: 'push.platform must be ios' }),
      token: stringFor('push.token')
        .trim()
        .toLowerCase()
        .regex(APNS_TOKEN, 'push.token must be the APNs token in hex'),
    },
    { error: 'push is required' },
  ),
});

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

/** O aluno da sessão (a rota só chega aqui com `session`). */
const actor = (res: Response): StudentActor => actorOf(res)!;

const toView = (watch: CallWatchView): CompanionWatchView => ({
  kind: watch.kind,
  until: watch.until.toISOString(),
});

/**
 * O "Me avise se abrirem" do iPhone em `/aouerj/v2/companion/watch`, só com
 * a sessão de aluno: o pedido de um push para a janela livre. Os pedidos
 * contam no limite por aluno; a leitura, não (o app a faz ao abrir a tela).
 */
export function companionWatchRoutes({
  companion,
  withDatabase,
  session,
  studentLimit,
}: {
  companion: Companion;
  withDatabase: RequestHandler;
  /** A sessão exigida (`requireStudentSession`). */
  session: RequestHandler;
  /** Os pedidos, por aluno, por minuto. */
  studentLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.get('/companion/watch', session, withDatabase, async (req, res) => {
    const status = await companion.watchStatus(actor(res));
    noStore(res).json({
      available: status.available,
      watch: status.watch ? toView(status.watch) : null,
    } satisfies CompanionWatchStatusResponse);
  });

  routes.post(
    '/companion/watch',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const { kind, until, seen, push } = parse(watchSchema, req.body);
      const watch = await companion.watch(actor(res), {
        kind,
        until,
        seen,
        device: push,
      });
      noStore(res).json({
        watch: toView(watch),
      } satisfies CompanionWatchResponse);
    },
  );

  routes.post(
    '/companion/watch/cancel',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      await companion.unwatch(actor(res));
      noStore(res).status(204).end();
    },
  );

  return routes;
}
