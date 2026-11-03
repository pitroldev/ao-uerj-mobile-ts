import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Logger } from 'pino';

import {
  createHttpApp,
  type HttpSettings,
  type Services,
} from './adapters/inbound/http/app.ts';
import type { DatabaseHealth } from './adapters/inbound/http/aouerj/status.ts';
import { repeatEvery } from './adapters/inbound/scheduling/repeat.ts';
import { createDevelopmentAttester } from './adapters/outbound/attestation/development.ts';
import { createPlayIntegrityAttester } from './adapters/outbound/attestation/playIntegrity.ts';
import { createFileAttachmentStore } from './adapters/outbound/files/attachmentStore.ts';
import { createDatabase } from './adapters/outbound/mongo/connection.ts';
import { defineModels } from './adapters/outbound/mongo/models.ts';
import {
  createMongoRepositories,
  type Repositories,
} from './adapters/outbound/mongo/repositories.ts';
import { createPortalProbe } from './adapters/outbound/portal/probe.ts';
import { createThreadedSolver } from './adapters/outbound/scheduleSolver/threadedSolver.ts';
import type { AttestationSettings, Config } from './config.ts';
import {
  createStudentAccess,
  createTokenIssuer,
  ISSUANCE_CHALLENGE_TTL_MS,
} from './modules/access/application.ts';
import type { AppAttester } from './modules/access/ports.ts';
import { createCompanion } from './modules/companion/application.ts';
import { createMural } from './modules/mural/application.ts';
import { createPortalWatch } from './modules/portal/application.ts';
import type { PortalWatch } from './modules/portal/ports.ts';
import { createErrorReports } from './modules/reports/application.ts';
import type { AttachmentStore } from './modules/reports/ports.ts';
import { createScheduleGenerator } from './modules/schedules/application.ts';
import type { ScheduleSolver } from './modules/schedules/ports.ts';
import { createSuggestions } from './modules/suggestions/application.ts';
import { createTeacherDirectory } from './modules/teachers/application.ts';

/** O banco como o servidor o usa: a saúde e a conexão. */
type Database = DatabaseHealth & {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
};

/** Adaptadores de saída trocáveis nos testes; o resto vem do ambiente. */
export type Overrides = {
  database?: Database;
  repositories?: Repositories;
  attachments?: AttachmentStore;
  portal?: PortalWatch;
  solver?: ScheduleSolver;
  /** Quem atesta o app; `null` desliga a emissão. */
  attester?: AppAttester | null;
};

/** O tempo que as conexões abertas têm para terminar no desligamento. */
const SHUTDOWN_GRACE_MS = 10000;

/** O banco e os repositórios: os de teste ou os do MongoDB. */
function storageFor(
  config: Config,
  logger: Logger,
  { database, repositories }: Overrides,
): { database: Database; repositories: Repositories } {
  if (database && repositories) return { database, repositories };
  const mongo = createDatabase({ ...config.mongo, logger });
  return {
    database: database ?? mongo,
    repositories:
      repositories ?? createMongoRepositories(defineModels(mongo.connection)),
  };
}

function httpSettingsOf(config: Config): HttpSettings {
  return {
    jsonLimit: config.http.jsonLimit,
    generatorJsonLimit: config.http.generatorJsonLimit,
    trustProxy: config.http.trustProxy,
    forceHttps: config.http.forceHttps,
    publicUrl: config.http.publicUrl,
    adminToken: config.http.adminToken,
    writesPerMinute: config.http.rateLimitPerMinute,
    generationsPerMinute: config.generator.perMinute,
    tokenRequestsPerMinute: config.studentAccess.issuance.perMinute,
    tokenBatchSize: config.studentAccess.issuance.batchSize,
    release: config.release,
  };
}

/** Quem atesta o app na emissão: a Play Integrity, o modo de teste ou ninguém. */
function attesterFor(
  settings: AttestationSettings | null,
  logger: Logger,
): AppAttester | null {
  if (!settings) return null;
  if (settings.mode === 'development') {
    logger.warn(
      'token attestation in development mode: any client gets tokens',
    );
    return createDevelopmentAttester();
  }
  return createPlayIntegrityAttester({
    account: settings.account,
    packageName: settings.packageName,
    certificateDigests: settings.certificateDigests,
    // o token de integridade é pedido depois do desafio, que vale cinco minutos
    maxAgeMs: ISSUANCE_CHALLENGE_TTL_MS + 60 * 1000,
  });
}

/**
 * A raiz de composição, o único lugar que conhece os dois lados do
 * hexágono: liga as portas de saída aos adaptadores (MongoDB, arquivos,
 * portal, threads), os casos de uso a elas, e os adaptadores de entrada (o
 * HTTP e o agendador) aos casos de uso. `start` sobe tudo sem esperar o banco
 * (as rotas dele respondem 503 até conectar); `stop` fecha na ordem inversa.
 */
export function createServer(
  config: Config,
  logger: Logger,
  overrides: Overrides = {},
) {
  const { database, repositories } = storageFor(config, logger, overrides);
  const portal =
    overrides.portal ?? createPortalWatch({ probe: createPortalProbe() });
  const solver =
    overrides.solver ??
    createThreadedSolver({
      concurrency: config.generator.concurrency,
      queueLimit: config.generator.queueLimit,
      budgetMs: config.generator.budgetMs,
    });

  const services: Services = {
    mural: createMural(repositories.messages),
    teachers: createTeacherDirectory(repositories.teachers, {
      cacheMs: config.teachersCacheMs,
    }),
    reports: createErrorReports(
      repositories.reports,
      overrides.attachments ?? createFileAttachmentStore(config.reportsDir),
    ),
    suggestions: createSuggestions(repositories.suggestions),
    portal,
    schedules: createScheduleGenerator(solver),
    access: createStudentAccess({
      keys: config.studentAccess.keys,
      spentTokens: repositories.spentTokens,
      issuer: config.studentAccess.issuer,
      origin: config.studentAccess.origin,
    }),
    tokens: createTokenIssuer({
      keys: config.studentAccess.keys,
      attester:
        overrides.attester === undefined
          ? attesterFor(config.studentAccess.issuance.attestation, logger)
          : overrides.attester,
      usedChallenges: repositories.usedChallenges,
      counter: repositories.issuanceCounters,
      batchSize: config.studentAccess.issuance.batchSize,
      batchesPerDay: config.studentAccess.issuance.batchesPerDay,
    }),
    companion: createCompanion({
      calls: repositories.companionCalls,
      reports: repositories.companionReports,
    }),
  };

  const app = createHttpApp({
    settings: httpSettingsOf(config),
    logger,
    services,
    database,
  });
  const server = http.createServer(app);
  const portalChecks = repeatEvery(
    config.portalMonitor.intervalMs,
    () => portal.check(),
    err => logger.warn({ err }, 'portal check failed'),
  );

  return {
    app,
    server,
    services,

    async start(port = config.port): Promise<AddressInfo> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, config.host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      const address = server.address() as AddressInfo;
      logger.info(
        { host: address.address, port: address.port, env: config.env },
        'listening',
      );
      void database.connect();
      if (config.portalMonitor.enabled) portalChecks.start();
      return address;
    },

    /**
     * Para de aceitar conexões e espera as requisições em andamento (uma
     * geração inclusive) até `SHUTDOWN_GRACE_MS`; o que passar disso é
     * cortado. Só então fecha as threads e o banco. Na troca azul/verde, o
     * nginx já mandou o tráfego novo para a outra cor.
     */
    async stop(): Promise<void> {
      portalChecks.stop();
      const forceClose = setTimeout(
        () => server.closeAllConnections(),
        SHUTDOWN_GRACE_MS,
      );
      forceClose.unref();
      await new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
      clearTimeout(forceClose);
      await solver.close?.();
      await database.disconnect();
    },
  };
}

export type Server = ReturnType<typeof createServer>;
