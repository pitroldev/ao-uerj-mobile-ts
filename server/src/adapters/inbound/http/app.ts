import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';

import type { ScheduleGenerator } from '../../../modules/schedules/ports.ts';
import { createAoUerjRouter, type AoUerjServices } from './aouerj/router.ts';
import type { DatabaseHealth, Release } from './aouerj/status.ts';
import { handleError, notFound } from './errors.ts';
import { forceHttps, requestLog } from './middleware.ts';
import { createSchedulesRouter } from './schedules/router.ts';

/** As portas de entrada que o HTTP usa. */
export type Services = AoUerjServices & { schedules: ScheduleGenerator };

/** O que o HTTP precisa da configuração. */
export type HttpSettings = {
  /** O corpo das rotas de `/aouerj` (100 KB, como no servidor antigo). */
  jsonLimit: string;
  /** O corpo das rotas de `/schedules`. */
  generatorJsonLimit: string;
  /** Saltos de proxy confiáveis, como o Express espera. */
  trustProxy: number | boolean | string | undefined;
  /** Com a origem pública, HTTP volta para HTTPS (308). */
  forceHttps: boolean;
  publicUrl: string | undefined;
  /** Libera a administração: as listagens com e-mail e `/aouerj/admin`. */
  adminToken: string | undefined;
  /** Por IP, por minuto: as gravações de `/aouerj`, juntas. */
  writesPerMinute: number;
  /** Por IP, por minuto: as gerações de grade. */
  generationsPerMinute: number;
  /** A versão no ar, para o `GET /aouerj/status`. */
  release: Release;
};

/** O servidor HTTP do AO UERJ: as rotas em `/aouerj` e o gerador em `/schedules`. */
export function createHttpApp({
  settings,
  logger,
  services,
  database,
}: {
  settings: HttpSettings;
  logger: Logger;
  services: Services;
  database: DatabaseHealth;
}) {
  const app = express();

  if (settings.trustProxy !== undefined)
    app.set('trust proxy', settings.trustProxy);
  app.disable('x-powered-by');

  app.use(requestLog(logger));
  // sem HSTS: ele valeria para o pitrol.dev inteiro e os subdomínios, e quem
  // decide isso é o nginx do domínio, não esta API
  app.use(helmet({ strictTransportSecurity: false }));
  // os apps são nativos; o CORS aberto fica para quem testa pelo navegador
  app.use(cors());
  if (settings.forceHttps && settings.publicUrl)
    app.use(forceHttps(settings.publicUrl));

  // cada parte com o próprio limite de corpo
  app.use(
    '/aouerj',
    express.json({ limit: settings.jsonLimit }),
    createAoUerjRouter({
      basePath: '/aouerj',
      services,
      database,
      release: settings.release,
      adminToken: settings.adminToken,
      writesPerMinute: settings.writesPerMinute,
    }),
  );
  app.use(
    '/schedules',
    express.json({ limit: settings.generatorJsonLimit }),
    createSchedulesRouter({
      generator: services.schedules,
      generationsPerMinute: settings.generationsPerMinute,
    }),
  );

  app.use(notFound);
  app.use(handleError);
  return app;
}
