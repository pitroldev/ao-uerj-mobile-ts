import type { SessionCrypto, StudentBan } from '../domain/studentSession';

/**
 * O App Attest do iPhone: o id da chave nova e o objeto de atestação da
 * Apple sobre os bytes do pedido, os dois em base64 padrão.
 */
type AppAttestProof = { keyId: string; attestation: string };

/**
 * A prova de que é o app da loja num aparelho íntegro, sobre o pedido: o
 * token da Play Integrity (Android) ou o App Attest (iPhone).
 */
export type DeviceProof = { token: string } | { appAttest: AppAttestProof };

/** A prova do aparelho, ou por que não veio. */
export type Attestation =
  | DeviceProof
  /**
   * `transient`: rede, limite ou serviço ocupado (da Play ou da Apple).
   * `unavailable`: sem a Play ou o App Attest, versão antiga ou app fora da
   * loja; não adianta insistir logo.
   */
  | { failure: 'transient' | 'unavailable' };

/** O aparelho: a atestação do app e a criptografia da plataforma. */
export interface DeviceTrustPort {
  crypto: SessionCrypto;
  /** `requestHash`: o hash do pedido, em hex (`sessionRequestHash`). */
  attest(requestHash: string): Promise<Attestation>;
}

/** O pedido de sessão: o desafio, a instalação, a prova do aparelho e o aluno. */
export type SessionRequest = {
  challenge: Uint8Array;
  installation: Uint8Array;
  proof: DeviceProof;
  matricula: string;
  name: string;
};

type SessionRefusal =
  /** Desafio vencido ou já usado: vale pedir outro. */
  | 'invalid_challenge'
  /** O app, a instalação pela loja ou o aparelho não passaram. */
  | 'attestation_failed'
  | 'banned'
  /** A identificação ou a verificação da atestação fora do ar no servidor. */
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
