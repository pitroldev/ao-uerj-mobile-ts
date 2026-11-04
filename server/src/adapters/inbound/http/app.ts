import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';

import type {
  StudentAccess,
  TokenIssuer,
} from '../../../modules/access/ports.ts';
import type { CampusNow } from '../../../modules/campus-now/ports.ts';
import type { Companion } from '../../../modules/companion/ports.ts';
import type { ScheduleGenerator } from '../../../modules/schedules/ports.ts';
import type { StudentIdentity } from '../../../modules/students/ports.ts';
import { createAoUerjRouter, type AoUerjServices } from './aouerj/router.ts';
import type { DatabaseHealth, Release } from './aouerj/status.ts';
import { handleError, notFound } from './errors.ts';
import { forceHttps, perKeyLimit, requestLog } from './middleware.ts';
import { createSchedulesRouter } from './schedules/router.ts';
import { createV2Router } from './v2/router.ts';
import { actorOf, identifyStudent } from './v2/students.ts';

/** As portas de entrada que o HTTP usa. */
export type Services = AoUerjServices & {
  schedules: ScheduleGenerator;
  /** O acesso de aluno da v2 (o resgate dos tokens anônimos). */
  access: StudentAccess;
  /** A emissão dos tokens anônimos, em lotes. */
  tokens: TokenIssuer;
  /** A Companhia agora, na v2. */
  companion: Companion;
  /** Agora no campus, na v2. */
  campusNow: CampusNow;
  /** A identificação do aluno (v2) e a moderação dos alunos. */
  students: StudentIdentity;
};

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
  /**
   * A Companhia agora, por minuto: um teto folgado por IP e o limite de cada
   * chave de membro (o token já limita quem abre e quem entra).
   */
  companionLimits: { perIp: number; perMember: number };
  /** Por IP, por minuto: as gerações de grade. */
  generationsPerMinute: number;
  /** Por IP, por minuto: os desafios e os lotes de tokens, juntos. */
  tokenRequestsPerMinute: number;
  /** Quantos pedidos cabem num lote. */
  tokenBatchSize: number;
  /** Por IP, por minuto: os desafios e as entradas dos alunos. */
  studentRequestsPerMinute: number;
  /** Por aluno, por minuto: os pedidos com uma sessão que o cache conhece. */
  studentSessionRequestsPerMinute: number;
  /** Os tokens anônimos dos apps antigos ainda valem nas rotas de aluno. */
  acceptStudentTokens: boolean;
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

  // cada parte com o próprio limite de corpo; a v2 antes de /aouerj, que
  // continua igual para os apps publicados
  app.use(
    '/aouerj/v2',
    express.json({ limit: settings.jsonLimit }),
    createV2Router({
      access: services.access,
      tokens: services.tokens,
      companion: services.companion,
      campusNow: services.campusNow,
      students: services.students,
      mural: services.mural,
      teachers: services.teachers,
      reports: services.reports,
      database,
      tokenRequestsPerMinute: settings.tokenRequestsPerMinute,
      tokenBatchSize: settings.tokenBatchSize,
      companionLimits: settings.companionLimits,
      studentRequestsPerMinute: settings.studentRequestsPerMinute,
      studentSessionRequestsPerMinute: settings.studentSessionRequestsPerMinute,
      acceptTokens: settings.acceptStudentTokens,
    }),
  );
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
    // o gerador não depende do banco: sem ele, a geração segue sem o aluno
    identifyStudent(services.students, {
      bestEffort: () => database.isReady(),
    }),
    createSchedulesRouter({
      generator: services.schedules,
      generationsPerMinute: settings.generationsPerMinute,
      // por aluno, a mesma conta que a Companhia usa por chave
      studentLimit: perKeyLimit(settings.companionLimits.perMember, req =>
        req.res ? actorOf(req.res)?.studentId : undefined,
      ),
    }),
  );

  app.use(notFound);
  app.use(handleError);
  return app;
}
