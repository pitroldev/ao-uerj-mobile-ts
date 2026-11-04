import type { SessionCrypto, StudentBan } from '../domain/studentSession';

/** O token da Play Integrity sobre o pedido, ou por que não veio. */
export type Attestation =
  | { token: string }
  /**
   * `transient`: rede, limite da Play ou serviço ocupado. `unavailable`: sem
   * a Play, versão antiga ou app fora da loja; não adianta insistir logo.
   */
  | { failure: 'transient' | 'unavailable' };

/** O aparelho: a atestação do app (Android) e a criptografia da plataforma. */
export interface DeviceTrustPort {
  crypto: SessionCrypto;
  attest(requestHash: string): Promise<Attestation>;
}

/** O pedido de sessão: o desafio, a instalação, a atestação e o aluno. */
export type SessionRequest = {
  challenge: Uint8Array;
  installation: Uint8Array;
  integrityToken: string;
  matricula: string;
  name: string;
};

type SessionRefusal =
  /** Desafio vencido ou já usado: vale pedir outro. */
  | 'invalid_challenge'
  /** O app, a instalação pela loja ou o aparelho não passaram. */
  | 'attestation_failed'
  | 'banned'
  /** A identificação ou a Play Integrity fora do ar no servidor. */
  | 'unavailable';

export type SessionCreation =
  | { created: true; token: string; expiresAt: number }
  | { created: false; refusal: SessionRefusal; ban?: StudentBan };

/**
 * A identificação no servidor (pitrol.dev/aouerj/v2/students). Sem rede,
 * rejeita com o `AppError` do adaptador.
 */
export interface StudentSessionApiPort {
  /** O desafio de uso único; `null` com a identificação desligada no servidor. */
  challenge(): Promise<Uint8Array | null>;
  create(request: SessionRequest): Promise<SessionCreation>;
  /** O logout: a sessão deixa de valer no servidor. Não rejeita. */
  end(token: string): Promise<void>;
}

/** A sessão guardada: de qual conta (o `scope`) e até quando, mais ou menos. */
export type StoredSession = { token: string; scope: string; expiresAt: number };

/** A sessão e o id da instalação, no cofre. */
export interface StudentSessionStorePort {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
  /** Em base64url; `null` antes da primeira entrada. */
  readInstallation(): Promise<string | null>;
  writeInstallation(installation: string): Promise<void>;
}
