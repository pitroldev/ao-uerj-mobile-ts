import type { TokenCrypto } from '../domain/privateToken';
import type { TokenStock } from '../domain/tokenStock';

/** O token da Play Integrity sobre o lote, ou por que não veio. */
export type Attestation =
  | { token: string }
  /**
   * `transient`: rede, limite da Play ou serviço ocupado. `unavailable`: sem
   * a Play, versão antiga ou app fora da loja; não adianta insistir logo.
   */
  | { failure: 'transient' | 'unavailable' };

/** O aparelho: a atestação do app (Android) e a criptografia da plataforma. */
export interface DeviceTrustPort {
  crypto: TokenCrypto;
  attest(requestHash: string): Promise<Attestation>;
}

type IssuanceChallenge = {
  /** O desafio de uso único da emissão (5 minutos). */
  challenge: Uint8Array;
  /** A chave do emissor, no SPKI da RFC 9578. */
  tokenKey: Uint8Array;
};

export type IssuanceRequest = {
  challenge: Uint8Array;
  /** 32 bytes ao acaso, criados uma vez por instalação. */
  installation: Uint8Array;
  integrityToken: string;
  tokenRequests: Uint8Array[];
};

export type IssuanceRefusal =
  /** Desafio vencido ou já usado: vale pedir outro. */
  | 'invalid_challenge'
  /** A chave mudou entre o desafio e o pedido: vale pedir outro. */
  | 'invalid_token_request'
  | 'attestation_failed'
  | 'limit_reached'
  /** A emissão ou a Play Integrity fora do ar no servidor. */
  | 'unavailable';

export type Issuance =
  | { issued: true; tokenKey: Uint8Array; tokenResponses: Uint8Array[] }
  | { issued: false; refusal: IssuanceRefusal; retryAt?: number };

/**
 * O emissor (pitrol.dev/aouerj/v2/tokens). Sem rede, rejeita com o
 * `AppError` do adaptador.
 */
export interface TokenIssuerPort {
  /** `null` com a emissão desligada no servidor. */
  challenge(): Promise<IssuanceChallenge | null>;
  issue(request: IssuanceRequest): Promise<Issuance>;
}

/** O estoque e o id da instalação, guardados no aparelho. */
export interface TokenStorePort {
  readStock(): Promise<TokenStock | null>;
  writeStock(stock: TokenStock): Promise<void>;
  /** Em base64url; `null` antes da primeira emissão. */
  readInstallation(): Promise<string | null>;
  writeInstallation(installation: string): Promise<void>;
}
