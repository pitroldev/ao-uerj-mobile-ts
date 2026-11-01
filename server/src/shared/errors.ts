/**
 * Erros que os casos de uso lançam e o HTTP traduz. O `code` é o `error` da
 * resposta (`{ error, message }`), que os apps já conhecem.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
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
