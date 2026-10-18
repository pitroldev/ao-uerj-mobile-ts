export type ErrorCode =
  | 'LOGIN_FAILED'
  | 'ACCOUNT_UNAVAILABLE'
  | 'NOT_LOGGED_IN'
  | 'SESSION_EXPIRED'
  | 'SESSION_CHANGED'
  | 'POSSIBLY_BLOCKED'
  | 'PORTAL_LAYOUT_CHANGED'
  | 'NETWORK'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CANCELLED'
  | 'STORAGE_FAILED'
  | 'DOCUMENT_UNAVAILABLE'
  | 'DOCUMENT_CHANGED'
  | 'DOCUMENT_NOT_REMOVED'
  | 'PAGE_UNAVAILABLE'
  | 'INVALID_INPUT';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isTransientError(error: unknown): boolean {
  return (
    error instanceof AppError &&
    ['NETWORK', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'].includes(error.code)
  );
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof AppError))
    return 'Não foi possível concluir. Tente novamente.';
  const messages: Record<ErrorCode, string> = {
    LOGIN_FAILED: 'Matrícula ou senha inválida. Confira seus dados.',
    ACCOUNT_UNAVAILABLE:
      'Matrícula inexistente, sem acesso ao Aluno Online ou portal em manutenção. Confira a matrícula ou tente mais tarde.',
    NOT_LOGGED_IN: 'Entre na sua conta para continuar.',
    SESSION_EXPIRED: 'Sua sessão expirou. Entre novamente.',
    SESSION_CHANGED: 'Sua sessão mudou. Tente novamente.',
    POSSIBLY_BLOCKED: 'O Aluno Online restringiu temporariamente este acesso.',
    PORTAL_LAYOUT_CHANGED:
      'O Aluno Online retornou dados em um formato inesperado.',
    NETWORK: 'Verifique sua conexão e tente novamente.',
    SERVICE_UNAVAILABLE:
      'O serviço está indisponível. Tente novamente mais tarde.',
    RATE_LIMITED: 'Aguarde um pouco antes de tentar novamente.',
    CANCELLED: 'Operação cancelada.',
    STORAGE_FAILED:
      'Não foi possível salvar seu acesso com segurança. Tente novamente.',
    DOCUMENT_UNAVAILABLE:
      'Este documento não está disponível para sua conta no Aluno Online.',
    DOCUMENT_CHANGED:
      'O documento mudou no Aluno Online. Atualize a lista e tente novamente.',
    DOCUMENT_NOT_REMOVED:
      'O Aluno Online não confirmou a exclusão. Atualize a lista antes de tentar novamente.',
    PAGE_UNAVAILABLE:
      'Esta página não está disponível para sua conta no Aluno Online agora.',
    INVALID_INPUT: 'Confira os dados informados.',
  };
  return messages[error.code];
}
