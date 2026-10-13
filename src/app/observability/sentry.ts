import * as Sentry from '@sentry/react-native';
import type { ErrorMonitorPort } from '@root/modules/support/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import {
  describeQueryKey,
  filterEvent,
  privacyIntegration,
  sanitizeBreadcrumb,
} from './privacy';

let enabled = false;
let lastSentEventId: string | undefined;
let currentScreen: string | undefined;

/**
 * Inicializa o Sentry com coleta mínima. Fica desligado em desenvolvimento e
 * sem DSN; aí todas as funções deste módulo viram no-op.
 *
 * Release e dist vêm do app nativo (applicationId@versionName+versionCode), os
 * mesmos usados pelo Gradle no envio dos source maps.
 */
export function startObservability({
  dsn,
  isDev,
}: {
  dsn: string;
  isDev: boolean;
}): boolean {
  if (enabled || !dsn || isDev) return false;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    // Sem tracing (nenhum tracesSampleRate), profiling nem Session Replay: as
    // telas mostram nome e notas, e spans HTTP levariam a URL de login do AO,
    // que tem a senha.
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    enableStallTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    // Rastros nativos de rede (iOS), conectividade, sistema e componentes.
    // Ficam os de ciclo de vida do app e da activity.
    enableNetworkBreadcrumbs: false,
    enableNetworkEventBreadcrumbs: false,
    enableSystemEventBreadcrumbs: false,
    enableAppComponentBreadcrumbs: false,
    enableAutoBreadcrumbTracking: false,
    integrations: defaults => [
      ...defaults.filter(
        ({ name }) => name !== 'Breadcrumbs' && name !== 'HttpContext',
      ),
      Sentry.breadcrumbsIntegration({
        console: false,
        fetch: false,
        xhr: false,
      }),
      privacyIntegration(),
    ],
    beforeBreadcrumb: breadcrumb => sanitizeBreadcrumb(breadcrumb),
    beforeSend: (event, hint) => {
      const kept = filterEvent(event, hint);
      if (kept) lastSentEventId = kept.event_id;
      return kept;
    },
  });
  enabled = true;
  return true;
}

/** Erro de renderização pego pelo ErrorBoundary da raiz. */
export function reportRenderError(
  error: unknown,
  componentStack?: string | null,
) {
  if (!enabled) return;
  Sentry.captureException(error, {
    mechanism: { type: 'react.errorboundary', handled: true },
    captureContext: { contexts: { react: { componentStack } } },
  });
}

/**
 * O portal mudou o HTML de uma operação. Vai como erro tratado, agrupado por
 * operação; o evento leva a pilha do parser, nunca o HTML nem dados do aluno.
 */
export function reportPortalLayoutChange(error: AppError, operation: string) {
  if (!enabled) return;
  Sentry.captureException(error, {
    fingerprint: ['portal-layout-changed', operation],
    tags: { 'portal.operation': operation },
  });
}

/**
 * Erro de query ou mutation que não é AppError, ou seja, defeito do app. Os
 * AppError são estados esperados ou, no caso do layout do portal, já são
 * reportados nas portas do AO.
 */
export function reportQueryError(
  error: unknown,
  queryKey?: readonly unknown[],
) {
  if (!enabled || error instanceof AppError) return;
  Sentry.captureException(error, {
    tags: { query: queryKey ? describeQueryKey(queryKey) : 'mutation' },
  });
}

/** Troca de tela, só com o nome da rota (sem parâmetros). */
export function recordScreen(name: string | undefined) {
  if (!name || name === currentScreen) return;
  const from = currentScreen;
  currentScreen = name;
  if (!enabled) return;
  Sentry.addBreadcrumb({
    category: 'navigation',
    type: 'navigation',
    data: from ? { from, to: name } : { to: name },
  });
}

/**
 * Relato do aluno: vai ao Sentry como feedback, com mensagem fixa, a tela e a
 * categoria, ligado ao último erro enviado. A descrição fica só no relato.
 */
export const errorMonitor: ErrorMonitorPort = {
  linkReport({ operation, category }) {
    if (!enabled) return null;
    return Sentry.captureFeedback({
      message: 'Relato de problema enviado pelo app.',
      associatedEventId: lastSentEventId,
      tags: { 'report.page': operation, 'report.category': category },
    });
  },
};
