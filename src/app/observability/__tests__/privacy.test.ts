import type { ErrorEvent, Event } from '@sentry/react-native';
import { AppError, type ErrorCode } from '@root/shared/errors/AppError';
import {
  describeQueryKey,
  filterEvent,
  isExpectedFailure,
  privacyIntegration,
  sanitizeBreadcrumb,
  scrubText,
} from '../privacy';

const LOGIN_URL =
  'https://www.alunoonline.uerj.br/requisicaoaluno/?requisicao=123&matricula=209912345678&senha=senha-secreta&_token=csrf';

function errorEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    type: undefined,
    event_id: 'abc',
    exception: { values: [{ type: 'Error', value: `Falhou ${LOGIN_URL}` }] },
    ...overrides,
  };
}

describe('isExpectedFailure', () => {
  it.each<ErrorCode>([
    'NETWORK',
    'SERVICE_UNAVAILABLE',
    'RATE_LIMITED',
    'CANCELLED',
    'SESSION_EXPIRED',
    'SESSION_CHANGED',
    'NOT_LOGGED_IN',
    'LOGIN_FAILED',
    'ACCOUNT_UNAVAILABLE',
    'POSSIBLY_BLOCKED',
    'INVALID_INPUT',
  ])('treats AppError(%s) as an expected state', code => {
    expect(isExpectedFailure(new AppError(code))).toBe(true);
  });

  it.each<ErrorCode>(['PORTAL_LAYOUT_CHANGED', 'STORAGE_FAILED'])(
    'reports AppError(%s)',
    code => {
      expect(isExpectedFailure(new AppError(code))).toBe(false);
    },
  );

  it('drops network failures that escaped the adapters', () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      config: { url: LOGIN_URL },
    });
    expect(isExpectedFailure(axiosError)).toBe(true);
    expect(isExpectedFailure(new Error('Network request failed'))).toBe(true);
    expect(isExpectedFailure(new Error('timeout of 15000ms exceeded'))).toBe(
      true,
    );
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isExpectedFailure(abort)).toBe(true);
  });

  it('keeps app defects and non-error values', () => {
    expect(isExpectedFailure(new TypeError('x is undefined'))).toBe(false);
    expect(isExpectedFailure('falha')).toBe(false);
    expect(isExpectedFailure(undefined)).toBe(false);
  });
});

describe('scrubText', () => {
  it('removes query strings and sensitive key=value pairs', () => {
    expect(scrubText(`GET ${LOGIN_URL} falhou`)).toBe(
      'GET https://www.alunoonline.uerj.br/requisicaoaluno/ falhou',
    );
    expect(scrubText('matricula=209912345678&senha=abc')).toBe(
      'matricula=[removido]&senha=[removido]',
    );
    expect(scrubText('Tela de notas: falhou?')).toBe('Tela de notas: falhou?');
  });
});

describe('sanitizeBreadcrumb', () => {
  it.each(['xhr', 'fetch', 'console', 'touch', 'ui.click', undefined])(
    'drops %s breadcrumbs',
    category => {
      expect(
        sanitizeBreadcrumb({ category, message: LOGIN_URL, data: {} }),
      ).toBeNull();
    },
  );

  it('drops http breadcrumbs even in an allowed category', () => {
    expect(
      sanitizeBreadcrumb({
        category: 'navigation',
        type: 'http',
        data: { url: LOGIN_URL },
      }),
    ).toBeNull();
  });

  it('keeps navigation with primitive, scrubbed data only', () => {
    expect(
      sanitizeBreadcrumb({
        category: 'navigation',
        type: 'navigation',
        data: {
          from: 'Login',
          to: 'Início',
          params: { subjectId: 'IME02-01388' },
          url: LOGIN_URL,
        },
      }),
    ).toEqual({
      category: 'navigation',
      type: 'navigation',
      data: {
        from: 'Login',
        to: 'Início',
        url: 'https://www.alunoonline.uerj.br/requisicaoaluno/',
      },
    });
  });
});

describe('filterEvent (beforeSend)', () => {
  it('drops events of expected failures', () => {
    expect(
      filterEvent(errorEvent(), { originalException: new AppError('NETWORK') }),
    ).toBeNull();
  });

  it('strips request, user details, query strings and unsafe breadcrumbs', () => {
    const event = filterEvent(
      errorEvent({
        message: `Erro em ${LOGIN_URL}`,
        request: { url: LOGIN_URL, data: 'senha=abc' },
        user: { id: 'instalacao', ip_address: '200.1.1.1', username: 'nome' },
        breadcrumbs: [
          { category: 'xhr', data: { url: LOGIN_URL } },
          { category: 'ui.lifecycle', data: { screen: 'MainActivity' } },
        ],
      }),
      { originalException: new AppError('PORTAL_LAYOUT_CHANGED') },
    );
    expect(event).not.toBeNull();
    expect(event).not.toHaveProperty('request');
    expect(event?.user).toEqual({ id: 'instalacao' });
    expect(event?.message).toBe(
      'Erro em https://www.alunoonline.uerj.br/requisicaoaluno/',
    );
    expect(event?.exception?.values?.[0].value).toBe(
      'Falhou https://www.alunoonline.uerj.br/requisicaoaluno/',
    );
    expect(event?.breadcrumbs).toEqual([
      { category: 'ui.lifecycle', data: { screen: 'MainActivity' } },
    ]);
    expect(JSON.stringify(event)).not.toMatch(/senha|209912345678|200\.1/);
  });

  it('drops a user without the installation id', () => {
    const event = filterEvent(
      errorEvent({ user: { ip_address: '{{auto}}' } }),
      { originalException: new TypeError('x') },
    );
    expect(event).not.toHaveProperty('user');
  });
});

it('scrubs feedback events, which skip beforeSend', () => {
  const { processEvent } = privacyIntegration();
  const feedback: Event = {
    type: 'feedback',
    request: { url: LOGIN_URL },
    breadcrumbs: [{ category: 'console', message: 'senha=abc' }],
  };
  const processed = processEvent?.(feedback, {}, {} as never) as Event;
  expect(processed).not.toHaveProperty('request');
  expect(processed.breadcrumbs).toEqual([]);
});

it('labels queries without the account scope or parameters', () => {
  expect(
    describeQueryKey(['academics', 'account-x1', '2026.2', 'grades']),
  ).toBe('academics/grades');
  expect(
    describeQueryKey([
      'academics',
      'account-x1',
      '2026.2',
      'subject-details',
      'IME02-01388',
    ]),
  ).toBe('academics/subject-details');
  expect(
    describeQueryKey(['community', 'account-x1', 'teacher', 'Nome Docente']),
  ).toBe('community/teacher');
  expect(
    describeQueryKey(['preferences', 'account-x1', 'elective-credits']),
  ).toBe('preferences/elective-credits');
  expect(describeQueryKey(['outra', 'account-x1'])).toBe('outra');
  expect(describeQueryKey([{ scope: 'account-x1' }])).toBe('desconhecida');
});
