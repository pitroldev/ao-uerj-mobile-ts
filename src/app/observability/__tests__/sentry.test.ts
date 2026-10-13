import type * as SentrySdk from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
type Observability = typeof import('../sentry');
type Errors = typeof import('@root/shared/errors/AppError');

const DSN = 'https://chave@o1.ingest.de.sentry.io/1';

/**
 * Módulos novos a cada teste: o estado (ligado, última tela) é por execução. O
 * AppError vem do mesmo registro, senão o instanceof do módulo falha.
 */
function load() {
  let observability!: Observability;
  let sdk!: jest.Mocked<typeof SentrySdk>;
  let errors!: Errors;
  jest.isolateModules(() => {
    observability = require('../sentry');
    sdk = require('@sentry/react-native');
    errors = require('@root/shared/errors/AppError');
  });
  return { observability, sdk, AppError: errors.AppError };
}

function start() {
  const loaded = load();
  expect(
    loaded.observability.startObservability({ dsn: DSN, isDev: false }),
  ).toBe(true);
  const options = loaded.sdk.init.mock.calls[0][0];
  return { ...loaded, options };
}

const event = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
  type: undefined,
  event_id: 'evento-1',
  ...overrides,
});

it.each([
  ['without a DSN', { dsn: '', isDev: false }],
  ['in development', { dsn: DSN, isDev: true }],
])('stays off %s and every report is a no-op', (_, config) => {
  const { observability, sdk, AppError } = load();
  expect(observability.startObservability(config)).toBe(false);
  observability.reportRenderError(new Error('render'), 'in Tela');
  observability.reportPortalLayoutChange(
    new AppError('PORTAL_LAYOUT_CHANGED'),
    'grades',
  );
  observability.reportQueryError(new TypeError('bug'), ['academics']);
  observability.recordScreen('Início');
  expect(
    observability.errorMonitor.linkReport({
      operation: 'Quadro de Notas',
      category: 'USER_REPORT',
    }),
  ).toBeNull();
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.captureException).not.toHaveBeenCalled();
  expect(sdk.captureFeedback).not.toHaveBeenCalled();
  expect(sdk.addBreadcrumb).not.toHaveBeenCalled();
});

it('initializes once with minimal collection: no PII, tracing, replay or attachments', () => {
  const { observability, sdk, options } = start();
  expect(observability.startObservability({ dsn: DSN, isDev: false })).toBe(
    false,
  );
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(options).toMatchObject({
    dsn: DSN,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    enableAppStartTracking: false,
    enableNetworkBreadcrumbs: false,
    enableNetworkEventBreadcrumbs: false,
  });
  expect(options.maxBreadcrumbs).toBeLessThanOrEqual(30);
  for (const key of [
    'tracesSampleRate',
    'tracesSampler',
    'profilesSampleRate',
    'replaysSessionSampleRate',
    'replaysOnErrorSampleRate',
    'release',
    'dist',
  ]) {
    expect(options).not.toHaveProperty(key);
  }
});

it('replaces the breadcrumb integration (no xhr, fetch or console) and drops the HTTP context', () => {
  const { sdk, options } = start();
  const defaults = ['Breadcrumbs', 'HttpContext', 'Dedupe'].map(name => ({
    name,
  }));
  const integrations = (
    options.integrations as (list: typeof defaults) => typeof defaults
  )(defaults);
  expect(integrations.map(({ name }) => name)).toEqual([
    'Dedupe',
    'Breadcrumbs',
    'AoUerjPrivacy',
  ]);
  expect(sdk.breadcrumbsIntegration).toHaveBeenCalledWith({
    console: false,
    fetch: false,
    xhr: false,
  });
});

it('filters breadcrumbs and events before sending', () => {
  const { options, AppError } = start();
  expect(
    options.beforeBreadcrumb?.({
      category: 'xhr',
      data: { url: 'https://www.alunoonline.uerj.br/?senha=x' },
    }),
  ).toBeNull();
  expect(
    options.beforeSend?.(event(), {
      originalException: new AppError('SESSION_EXPIRED'),
    }),
  ).toBeNull();
  expect(
    options.beforeSend?.(event({ request: { url: 'https://x.test/?a=1' } }), {
      originalException: new TypeError('bug'),
    }),
  ).toEqual(event());
});

it('sends a portal layout change as a handled error grouped by operation', () => {
  const { observability, sdk, AppError } = start();
  const error = new AppError('PORTAL_LAYOUT_CHANGED');
  observability.reportPortalLayoutChange(error, 'grades');
  expect(sdk.captureException).toHaveBeenCalledWith(error, {
    fingerprint: ['portal-layout-changed', 'grades'],
    tags: { 'portal.operation': 'grades' },
  });
});

it('reports only unexpected query errors, labeled without the account scope', () => {
  const { observability, sdk, AppError } = start();
  observability.reportQueryError(new AppError('PORTAL_LAYOUT_CHANGED'), [
    'academics',
    'account-x1',
    '2026.2',
    'grades',
  ]);
  observability.reportQueryError(new AppError('NETWORK'));
  expect(sdk.captureException).not.toHaveBeenCalled();

  const bug = new TypeError('bug');
  observability.reportQueryError(bug, [
    'academics',
    'account-x1',
    '2026.2',
    'grades',
  ]);
  observability.reportQueryError(bug);
  expect(sdk.captureException.mock.calls).toEqual([
    [bug, { tags: { query: 'academics/grades' } }],
    [bug, { tags: { query: 'mutation' } }],
  ]);
});

it('records screen changes by route name only', () => {
  const { observability, sdk } = start();
  observability.recordScreen(undefined);
  observability.recordScreen('Login');
  observability.recordScreen('Login');
  observability.recordScreen('Início');
  expect(sdk.addBreadcrumb.mock.calls).toEqual([
    [{ category: 'navigation', type: 'navigation', data: { to: 'Login' } }],
    [
      {
        category: 'navigation',
        type: 'navigation',
        data: { from: 'Login', to: 'Início' },
      },
    ],
  ]);
});

it('links a user report to the last error actually sent, without its description', () => {
  const { observability, sdk, options, AppError } = start();
  options.beforeSend?.(event({ event_id: 'descartado' }), {
    originalException: new AppError('NETWORK'),
  });
  options.beforeSend?.(event({ event_id: 'enviado' }), {
    originalException: new TypeError('bug'),
  });
  expect(
    observability.errorMonitor.linkReport({
      operation: 'Quadro de Notas',
      category: 'USER_REPORT',
    }),
  ).toBe('feedback-de-teste');
  expect(sdk.captureFeedback).toHaveBeenCalledWith({
    message: 'Relato de problema enviado pelo app.',
    associatedEventId: 'enviado',
    tags: {
      'report.page': 'Quadro de Notas',
      'report.category': 'USER_REPORT',
    },
  });
});
