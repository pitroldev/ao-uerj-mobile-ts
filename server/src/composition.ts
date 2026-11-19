import { X509Certificate } from 'node:crypto';
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
import { createAppAttestVerifier } from './adapters/outbound/attestation/appAttest.ts';
import { appleAppAttestationRoot } from './adapters/outbound/attestation/appleRoot.ts';
import { createDevelopmentAttester } from './adapters/outbound/attestation/development.ts';
import { createPlayIntegrityAttester } from './adapters/outbound/attestation/playIntegrity.ts';
import { createFileAttachmentStore } from './adapters/outbound/files/attachmentStore.ts';
import { createFileOtaAssetStore } from './adapters/outbound/files/otaAssetStore.ts';
import { createDatabase } from './adapters/outbound/mongo/connection.ts';
import { defineModels } from './adapters/outbound/mongo/models.ts';
import {
  createMongoRepositories,
  type Repositories,
} from './adapters/outbound/mongo/repositories.ts';
import {
  OTA_NO_UPDATE_AVAILABLE_SIGNATURE,
  otaCodeSigningCertificate,
} from './adapters/outbound/ota/certificate.ts';
import { createOtaSignatureVerifier } from './adapters/outbound/ota/signature.ts';
import { createPortalProbe } from './adapters/outbound/portal/probe.ts';
import { createApnsSender } from './adapters/outbound/push/apns.ts';
import { createThreadedSolver } from './adapters/outbound/scheduleSolver/threadedSolver.ts';
import type {
  ApnsSettings,
  AppAttestSettings,
  AttestationSettings,
  Config,
} from './config.ts';
import {
  createStudentAccess,
  createTokenIssuer,
  ISSUANCE_CHALLENGE_TTL_MS,
} from './modules/access/application.ts';
import type { AppAttester, AppAttestVerifier } from './modules/access/ports.ts';
import { createCampusNow } from './modules/campus-now/application.ts';
import { createCompanion } from './modules/companion/application.ts';
import type { PushSender } from './modules/companion/ports.ts';
import { createMural } from './modules/mural/application.ts';
import { createOtaUpdates } from './modules/ota/application.ts';
import type { OtaAssetStore, OtaUpdates } from './modules/ota/ports.ts';
import {
  createPortalAlerts,
  createPortalWatch,
} from './modules/portal/application.ts';
import type { PortalWatch } from './modules/portal/ports.ts';
import { createErrorReports } from './modules/reports/application.ts';
import type { AttachmentStore } from './modules/reports/ports.ts';
import { createScheduleGenerator } from './modules/schedules/application.ts';
import { createStudentIdentity } from './modules/students/application.ts';
import { STUDENT_CHALLENGE_TTL_MS } from './modules/students/domain.ts';
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
  /**
   * O monitor do portal ligado (os testes, que têm `PORTAL_MONITOR` sempre
   * desligado): os testes agendados e o "Avisar quando voltar" por push.
   */
  portalMonitor?: boolean;
  solver?: ScheduleSolver;
  /** Quem atesta o app; `null` desliga a emissão. */
  attester?: AppAttester | null;
  /** O App Attest do iPhone; `null` desliga a entrada pelo iPhone. */
  appAttest?: AppAttestVerifier | null;
  /**
   * O push para o iPhone; `null` desliga o "Me avise se abrirem", os avisos
   * do Agora no campus e os do portal.
   */
  push?: PushSender | null;
  /**
   * As atualizações pelo ar: o certificado do code signing (`null` desliga
   * as publicações), a assinatura pronta do "nada novo" e os arquivos. Com
   * outro certificado, a assinatura embutida não vale (padrão `null`).
   */
  ota?: {
    certificate?: string | null;
    noUpdateSignature?: string | null;
    assets?: OtaAssetStore;
  };
};

/** O tempo que as conexões abertas têm para terminar no desligamento. */
const SHUTDOWN_GRACE_MS = 10000;

/**
 * De quanto em quanto tempo os pedidos de "Me avise se abrirem" olham a
 * lista: a chamada aberta com antecedência aparece uma hora antes, e uma
 * vaga pode abrir. Quem abre avisa na hora.
 */
const WATCH_DELIVERY_INTERVAL_MS = 60 * 1000;

/**
 * De quanto em quanto tempo o Agora no campus olha os avisos que venceram
 * (o "quantos agradeceram") e acorda os iPhones (no máximo um a cada meia
 * hora por aparelho).
 */
const CAMPUS_PUSH_INTERVAL_MS = 60 * 1000;

/**
 * De quanto em quanto tempo o cutucão da verificação no portal olha quem
 * cutucar (cada aparelho, no máximo a cada 4 horas).
 */
const PORTAL_WAKE_ROUND_MS = 60 * 1000;

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
    companionLimits: config.http.companion,
    generationsPerMinute: config.generator.perMinute,
    tokenRequestsPerMinute: config.studentAccess.issuance.perMinute,
    tokenBatchSize: config.studentAccess.issuance.batchSize,
    studentRequestsPerMinute: config.students.perMinute,
    studentSessionRequestsPerMinute: config.students.sessionPerMinute,
    acceptStudentTokens: config.students.acceptTokens,
    release: config.release,
    ota: {
      assetLimitBytes: config.ota.assetLimitBytes,
      publishPerMinute: config.ota.publishPerMinute,
      manifestPerMinute: config.ota.manifestPerMinute,
    },
  };
}

/**
 * As atualizações pelo ar, com o certificado embutido (o mesmo do app) e os
 * arquivos em `OTA_DIR`. A assinatura pronta do "nada novo" é conferida com
 * o certificado aqui, na partida.
 */
function otaFor(
  config: Config,
  logger: Logger,
  repositories: Repositories,
  overrides: Overrides['ota'] = {},
): OtaUpdates {
  const pem = overrides.certificate;
  const certificate =
    pem === undefined
      ? otaCodeSigningCertificate()
      : pem === null
        ? null
        : new X509Certificate(pem);
  const noUpdateSignature =
    overrides.noUpdateSignature !== undefined
      ? overrides.noUpdateSignature
      : pem === undefined
        ? OTA_NO_UPDATE_AVAILABLE_SIGNATURE
        : null;
  if (!certificate)
    logger.warn('OTA publishing is off: no code signing certificate');
  else if (Date.parse(certificate.validTo) < Date.now())
    logger.warn(
      { validTo: certificate.validTo },
      'the OTA code signing certificate expired: the apps refuse its signatures',
    );
  return createOtaUpdates({
    entries: repositories.otaEntries,
    assets: overrides.assets ?? createFileOtaAssetStore(config.ota.dir),
    verifier: certificate ? createOtaSignatureVerifier(certificate) : null,
    noUpdateSignature,
    assetOrigin: config.ota.assetOrigin,
    onCleanupError: err => logger.warn({ err }, 'OTA cleanup failed'),
  });
}

/**
 * Quem atesta o app: a Play Integrity, o modo de teste ou ninguém. A entrada
 * do aluno exige também o app instalado pela loja (`requireLicensed`).
 */
function attesterFor(
  settings: AttestationSettings | null,
  logger: Logger,
  {
    challengeTtlMs,
    requireLicensed,
  }: { challengeTtlMs: number; requireLicensed: boolean },
): AppAttester | null {
  if (!settings) return null;
  if (settings.mode === 'development') {
    logger.warn('app attestation in development mode: any client gets through');
    return createDevelopmentAttester();
  }
  return createPlayIntegrityAttester({
    account: settings.account,
    packageName: settings.packageName,
    certificateDigests: settings.certificateDigests,
    // o token de integridade é pedido depois do desafio
    maxAgeMs: challengeTtlMs + 60 * 1000,
    requireLicensed,
  });
}

/**
 * O App Attest do iPhone, conferido contra a raiz da Apple fixada no código;
 * sem o App ID (a conta da Apple), `null`, e o iPhone não entra.
 */
function appAttestFor(
  settings: AppAttestSettings | null,
  logger: Logger,
): AppAttestVerifier | null {
  if (!settings) return null;
  if (settings.environment === 'development')
    logger.warn(
      'App Attest also accepts development keys (builds run from Xcode)',
    );
  return createAppAttestVerifier({
    appId: settings.appId,
    root: appleAppAttestationRoot(),
    environment: settings.environment,
  });
}

/**
 * O push para o iPhone pelo APNs; sem a chave da conta da Apple, `null`, e o
 * "Me avise se abrirem" do iPhone fica desligado (503 `push_unavailable`).
 */
function pushFor(
  settings: ApnsSettings | null,
  logger: Logger,
): PushSender | null {
  if (!settings) {
    logger.warn(
      'iPhone push is off: APNS_KEY_ID and APNS_PRIVATE_KEY are required',
    );
    return null;
  }
  return createApnsSender({
    keyId: settings.keyId,
    teamId: settings.teamId,
    privateKey: settings.privateKey,
    topic: settings.topic,
    environment: settings.environment,
    // o status e o motivo da Apple, nunca o token do aparelho
    onError: err =>
      logger.warn(
        { status: err.status, reason: err.reason },
        'APNs did not take a push',
      ),
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

  const push =
    overrides.push === undefined
      ? pushFor(config.push.apns, logger)
      : overrides.push;
  const companion = createCompanion({
    calls: repositories.companionCalls,
    reports: repositories.companionReports,
    stats: repositories.companionStats,
    watchers: repositories.companionWatchers,
    watches: repositories.companionCallWatches,
    push,
    onPushError: err => logger.warn({ err }, 'companion watch delivery failed'),
  });
  const campusNow = createCampusNow({
    notices: repositories.campusNotices,
    answers: repositories.campusAnswers,
    contributors: repositories.campusPeople,
    days: repositories.campusDays,
    pushDevices: repositories.campusPushDevices,
    push,
    onPushError: err => logger.warn({ err }, 'campus push failed'),
  });
  const portalMonitor = overrides.portalMonitor ?? config.portalMonitor.enabled;
  const portalAlerts = createPortalAlerts({
    returnAlerts: repositories.portalReturnAlerts,
    devices: repositories.portalPushDevices,
    push,
    monitoring: portalMonitor,
    onPushError: err => logger.warn({ err }, 'portal push failed'),
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
          ? attesterFor(config.studentAccess.issuance.attestation, logger, {
              challengeTtlMs: ISSUANCE_CHALLENGE_TTL_MS,
              requireLicensed: false,
            })
          : overrides.attester,
      usedChallenges: repositories.usedChallenges,
      counter: repositories.issuanceCounters,
      batchSize: config.studentAccess.issuance.batchSize,
      batchesPerDay: config.studentAccess.issuance.batchesPerDay,
    }),
    companion,
    campusNow,
    portalAlerts,
    students: createStudentIdentity({
      students: repositories.students,
      sessions: repositories.studentSessions,
      usedChallenges: repositories.usedChallenges,
      attester:
        overrides.attester === undefined
          ? attesterFor(config.studentAccess.issuance.attestation, logger, {
              challengeTtlMs: STUDENT_CHALLENGE_TTL_MS,
              requireLicensed: true,
            })
          : overrides.attester,
      appAttest:
        overrides.appAttest === undefined
          ? appAttestFor(config.students.appAttest, logger)
          : overrides.appAttest,
      dataKey: config.students.dataKey,
      // o banido sai das mesas na hora, sem esperar ninguém denunciar de
      // novo, os avisos dele que valem saem do ar, e o iPhone dele deixa de
      // receber os avisos do portal
      onBan: async studentId => {
        await companion.dropStudent(studentId);
        await campusNow.dropStudent(studentId);
        await portalAlerts.dropStudent(studentId);
      },
    }),
    ota: otaFor(config, logger, repositories, overrides.ota),
  };

  const app = createHttpApp({
    settings: httpSettingsOf(config),
    logger,
    services,
    database,
  });
  const server = http.createServer(app);
  // depois de cada teste, com o portal no ar, quem pediu "Avisar quando
  // voltar" recebe o aviso; sem o banco, a entrega fica para o próximo
  const portalChecks = repeatEvery(
    config.portalMonitor.intervalMs,
    async () => {
      const status = await portal.check();
      if (push && database.isReady())
        await portalAlerts
          .portalChecked(status)
          .catch(err => logger.warn({ err }, 'portal push failed'));
    },
    err => logger.warn({ err }, 'portal check failed'),
  );
  // sem o banco, a rodada falha calada: os pedidos estão nele
  const watchDeliveries = repeatEvery(
    WATCH_DELIVERY_INTERVAL_MS,
    async () => {
      if (database.isReady()) await companion.deliverWatches();
    },
    err => logger.warn({ err }, 'companion watch delivery failed'),
  );
  const campusPushes = repeatEvery(
    CAMPUS_PUSH_INTERVAL_MS,
    async () => {
      if (database.isReady()) await campusNow.deliverPush();
    },
    err => logger.warn({ err }, 'campus push failed'),
  );
  const portalWakes = repeatEvery(
    PORTAL_WAKE_ROUND_MS,
    async () => {
      if (database.isReady()) await portalAlerts.wakeDevices();
    },
    err => logger.warn({ err }, 'portal push failed'),
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
      if (portalMonitor) portalChecks.start();
      if (push) {
        watchDeliveries.start();
        campusPushes.start();
        portalWakes.start();
      }
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
      watchDeliveries.stop();
      campusPushes.stop();
      portalWakes.stop();
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
      await push?.close?.();
      await database.disconnect();
    },
  };
}

export type Server = ReturnType<typeof createServer>;
