import type { Rejection } from './domain.ts';

/** O resultado de um resgate. */
export type Redemption =
  | { authenticated: true }
  | {
      authenticated: false;
      /** `unavailable`: nenhuma chave vale agora (configuração). */
      reason: Rejection | 'unavailable';
    };

/** Porta de entrada: o acesso de aluno da API v2. */
export interface StudentAccess {
  /**
   * Confere o `Authorization` e gasta o token: cada um vale uma requisição.
   */
  redeem(authorization: string | undefined): Promise<Redemption>;
  /**
   * O desafio e a chave para o `WWW-Authenticate` de quem não traz token
   * válido; `null` sem chave válida.
   */
  challenge(): { challenge: Buffer; tokenKey: Buffer } | null;
}

/** O desafio de emissão e a chave com que o app cega os pedidos. */
export type IssuanceChallenge = {
  challenge: Buffer;
  expiresAt: Date;
  tokenKey: Buffer;
};

/** Um pedido de lote, já com os tamanhos conferidos. */
export type IssuanceRequest = {
  challenge: Buffer;
  /** O id da instalação (32 bytes). */
  installation: Buffer;
  /** A atestação do app (Play Integrity) sobre o `issuanceRequestHash`. */
  integrityToken: string;
  /** Os TokenRequest (RFC 9578, 6.1), um por token. */
  tokenRequests: Buffer[];
};

/** Por que um lote não sai. */
export type IssuanceRefusal =
  /** Sem chave privada valendo ou sem quem ateste (configuração). */
  | 'unavailable'
  /** O desafio não é nosso, venceu ou já foi usado: pedir outro. */
  | 'invalid_challenge'
  /** Um pedido não é para a chave atual (o app cegou com outra). */
  | 'invalid_token_request'
  /** A atestação não confirma o app genuíno num aparelho íntegro. */
  | 'attestation_failed'
  /** A instalação já recebeu os lotes do dia. */
  | 'limit_reached';

export type Issuance =
  | { issued: true; tokenKey: Buffer; tokenResponses: Buffer[] }
  | {
      issued: false;
      reason: IssuanceRefusal;
      /** O motivo da atestação recusada, para o log. */
      detail?: string;
      /** Quando a instalação volta a poder pedir (no limite do dia). */
      retryAt?: Date;
    };

/** Porta de entrada: a emissão dos tokens de aluno, em lotes assinados às cegas. */
export interface TokenIssuer {
  /** Um desafio novo, de uso único; `null` sem emissão configurada. */
  challenge(): IssuanceChallenge | null;
  issue(request: IssuanceRequest): Promise<Issuance>;
}

/** O veredito de quem atesta o app. */
export type Attestation =
  { trusted: true } | { trusted: false; reason: string };

/**
 * Porta de saída: quem atesta que o pedido veio do app genuíno, num aparelho
 * íntegro (a Play Integrity). Lança `UnavailableError` se não responder.
 */
export interface AppAttester {
  verify(integrityToken: string, requestHash: string): Promise<Attestation>;
}

/**
 * Porta de saída: o que só vale uma vez (um token gasto, um desafio usado),
 * guardado só como hash.
 */
export interface SingleUse {
  /** Marca como gasto até `until`; `false` se já estava gasto. */
  spend(id: string, until: Date): Promise<boolean>;
}

/** Porta de saída: quantos lotes cada instalação recebeu no dia. */
export interface IssuanceCounter {
  /**
   * Conta mais um lote em `id` se ainda não chegou a `limit`, guardando até
   * `until`; `false` se já chegou.
   */
  count(id: string, limit: number, until: Date): Promise<boolean>;
}
