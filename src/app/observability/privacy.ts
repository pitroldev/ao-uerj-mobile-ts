import type {
  Breadcrumb,
  ErrorEvent,
  Event,
  ReactNativeOptions,
} from '@sentry/react-native';
import { AppError, type ErrorCode } from '@root/shared/errors/AppError';

type BeforeSend = NonNullable<ReactNativeOptions['beforeSend']>;
export type EventHint = Parameters<BeforeSend>[1];
type Integration = Extract<
  NonNullable<ReactNativeOptions['integrations']>,
  readonly unknown[]
>[number];

/**
 * Códigos que viram evento. Os demais descrevem estados esperados (rede,
 * portal fora do ar, sessão, cancelamento, credencial recusada, conta
 * indisponível, entrada inválida): não são defeito do app e só gastariam a
 * cota.
 */
const REPORTABLE_CODES: readonly ErrorCode[] = [
  'PORTAL_LAYOUT_CHANGED',
  'STORAGE_FAILED',
];

const EXPECTED_ERROR_NAMES = ['AbortError', 'CanceledError', 'CancelledError'];
const NETWORK_FAILURE =
  /^(?:Network Error|Network request failed|timeout of \d+ms exceeded)$/;

/** Falha transitória ou esperada, que não deve gerar evento. */
export function isExpectedFailure(error: unknown): boolean {
  if (error instanceof AppError) return !REPORTABLE_CODES.includes(error.code);
  if (!error || typeof error !== 'object') return false;
  const { name, message, isAxiosError } = error as {
    name?: unknown;
    message?: unknown;
    isAxiosError?: unknown;
  };
  // Erros do axios carregam a configuração da requisição, com URL e
  // parâmetros (o login do AO leva a senha na URL). Os adaptadores sempre os
  // convertem em AppError; se um escapar, é falha de rede.
  if (isAxiosError === true) return true;
  if (typeof name === 'string' && EXPECTED_ERROR_NAMES.includes(name))
    return true;
  return typeof message === 'string' && NETWORK_FAILURE.test(message);
}

const QUERY_STRING = /\?[^\s"'<>#]*=[^\s"'<>#]*/g;
const SENSITIVE_PAIR =
  /\b(senha|password|matr[ií]cula|_?token|cpf)\s*[=:]\s*[^\s&;,"']+/gi;

/** Remove query strings e pares chave=valor sensíveis de um texto livre. */
export function scrubText(text: string): string {
  return text
    .replace(QUERY_STRING, '')
    .replace(SENSITIVE_PAIR, '$1=[removido]');
}

/**
 * Só ficam rastros sem conteúdo do aluno: troca de tela (nome da rota), ciclo
 * de vida do app e da activity, eventos já enviados ao Sentry e chamadas
 * nativas lentas. Rede (xhr/fetch/http), console e toques são descartados.
 */
const BREADCRUMB_CATEGORIES = new Set([
  'navigation',
  'app.lifecycle',
  'ui.lifecycle',
  'sentry.event',
  'native.turbo_module',
]);

function primitiveData(data: Record<string, unknown>) {
  const entries = Object.entries(data).flatMap(([key, value]) => {
    if (typeof value === 'string') return [[key, scrubText(value)]];
    if (typeof value === 'number' || typeof value === 'boolean')
      return [[key, value]];
    return [];
  });
  return Object.fromEntries(entries) as Record<
    string,
    string | number | boolean
  >;
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const { category, type, message, data } = breadcrumb;
  if (!category || !BREADCRUMB_CATEGORIES.has(category) || type === 'http')
    return null;
  return {
    ...breadcrumb,
    ...(message === undefined ? {} : { message: scrubText(message) }),
    ...(data === undefined ? {} : { data: primitiveData(data) }),
  };
}

/**
 * Última barreira antes do envio, para qualquer tipo de evento: tira a
 * requisição, os dados de usuário (fica só o id aleatório da instalação, que o
 * SDK nativo cria), query strings das mensagens e os rastros fora da lista,
 * inclusive os que o SDK nativo mescla no evento sem passar pelo
 * beforeBreadcrumb.
 */
function scrubEvent(event: Event): void {
  delete event.request;
  if (event.user) {
    if (event.user.id === undefined) delete event.user;
    else event.user = { id: event.user.id };
  }
  if (typeof event.message === 'string')
    event.message = scrubText(event.message);
  if (event.logentry?.message)
    event.logentry.message = scrubText(event.logentry.message);
  event.exception?.values?.forEach(exception => {
    if (exception.value) exception.value = scrubText(exception.value);
  });
  if (event.breadcrumbs)
    event.breadcrumbs = event.breadcrumbs.flatMap(breadcrumb => {
      const safe = sanitizeBreadcrumb(breadcrumb);
      return safe ? [safe] : [];
    });
}

/** beforeSend: descarta falhas esperadas e limpa o resto. */
export function filterEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  if (isExpectedFailure(hint?.originalException)) return null;
  scrubEvent(event);
  return event;
}

/**
 * Aplica scrubEvent a todos os eventos, inclusive os de feedback, que não
 * passam pelo beforeSend.
 */
export function privacyIntegration(): Integration {
  return {
    name: 'AoUerjPrivacy',
    processEvent: event => {
      scrubEvent(event);
      return event;
    },
  };
}

/**
 * Rótulo de uma query sem o escopo da conta nem parâmetros (nome de docente,
 * disciplina, turma): só a raiz e o recurso.
 */
const RESOURCE_INDEX: Record<string, number> = {
  academics: 3,
  community: 2,
  preferences: 2,
};

export function describeQueryKey(queryKey: readonly unknown[]): string {
  const [root] = queryKey;
  if (typeof root !== 'string') return 'desconhecida';
  const index = RESOURCE_INDEX[root];
  const resource = index === undefined ? undefined : queryKey[index];
  return typeof resource === 'string' ? `${root}/${resource}` : root;
}
