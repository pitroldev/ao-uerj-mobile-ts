/**
 * Erros que os casos de uso lançam e o HTTP traduz. O `code` é o `error` da
 * resposta (`{ error, message }`), que os apps já conhecem.
 */
export class DomainError extends Error {
  readonly code: string;

  /** `cause` vai só para o log (a resposta leva a `message`). */
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Entrada que as regras do domínio recusam (vira 400). */
export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super('invalid_request', message);
  }
}

/** Um recurso de fora (banco, disco) não está disponível agora (vira 503). */
export class UnavailableError extends DomainError {}

/** O que foi pedido não existe, ou já não existe (vira 404). */
export class NotFoundError extends DomainError {}

/** Quem pede não pode mexer nisso (vira 403). */
export class ForbiddenError extends DomainError {}

/** O pedido bate com o estado de agora: lotado, encerrado (vira 409). */
export class ConflictError extends DomainError {}
