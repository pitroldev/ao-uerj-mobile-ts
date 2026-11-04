import type {
  Ban,
  BanDays,
  StoredSession,
  StoredStudent,
  Student,
} from './domain.ts';

/** O pedido de entrada, já com os tamanhos conferidos. */
export type EnrollmentRequest = {
  challenge: Buffer;
  /** O id da instalação (32 bytes), o mesmo de sempre naquele aparelho. */
  installation: Buffer;
  /** A atestação da Play Integrity sobre o `studentSessionRequestHash`. */
  integrityToken: string;
  matricula: string;
  name: string;
};

export type EnrollmentRefusal =
  /** Sem `STUDENT_DATA_KEY` ou sem quem ateste (configuração). */
  | 'unavailable'
  /** O desafio não é nosso, venceu ou já foi usado: pedir outro. */
  | 'invalid_challenge'
  /** A atestação não confirma o app da loja num aparelho íntegro. */
  | 'attestation_failed'
  /** A matrícula está banida. */
  | 'banned';

export type Enrollment =
  | { ok: true; token: Buffer; expiresAt: Date; studentId: string }
  | {
      ok: false;
      reason: EnrollmentRefusal;
      /** No `banned`, até quando e por quê. */
      ban?: Ban;
      /** No `attestation_failed`, o motivo, só para o log. */
      detail?: string;
    };

/** Quem fez o pedido, para os casos de uso que registram o aluno. */
export type StudentActor = { studentId: string };

export type Authentication =
  | { ok: true; studentId: string }
  | { ok: false; reason: 'invalid_session' }
  | { ok: false; reason: 'banned'; ban: Ban };

/** Porta de entrada: a identificação do aluno (a API v2 e a moderação). */
export interface StudentIdentity {
  /** Um desafio novo, de uso único; `null` com a identificação desligada. */
  challenge(): { challenge: Buffer; expiresAt: Date } | null;
  enroll(request: EnrollmentRequest): Promise<Enrollment>;
  /** Confere o token da sessão (com um cache curto) e se o aluno está banido. */
  authenticate(token: Buffer): Promise<Authentication>;
  /** A saída do app (o logout): a sessão deixa de valer. */
  endSession(token: Buffer): Promise<void>;

  /** Com a `STUDENT_DATA_KEY`: sem ela, ninguém entra e a moderação não abre nada. */
  available(): boolean;
  /** Para a moderação: o aluno aberto, pelo id ou pela matrícula. */
  find(id: string): Promise<Student | null>;
  findByMatricula(matricula: string): Promise<Student | null>;
  /** Os ids que aparecem nas denúncias e nos relatos, abertos. */
  describe(ids: readonly string[]): Promise<Map<string, Student>>;
  recent(limit: number): Promise<Student[]>;
  banned(limit: number): Promise<Student[]>;
  /** Vale na hora (o cache esquece o aluno) e chama o `onBan` da composição. */
  ban(id: string, days: BanDays, reason: string): Promise<Student | null>;
  unban(id: string): Promise<Student | null>;
}

/** Porta de saída: os alunos, com matrícula e nome cifrados. */
export interface StudentRepository {
  findByLookup(lookup: string): Promise<StoredStudent | null>;
  /**
   * Grava o aluno novo; se outro pedido gravou a mesma matrícula antes
   * (`lookup` único), devolve o que já estava.
   */
  create(student: StoredStudent): Promise<StoredStudent>;
  /** O aluno voltou: o nome do portal, o aparelho e a hora. */
  seen(
    id: string,
    update: { name: string; device: string; now: Date; keepDevices: number },
  ): Promise<StoredStudent | null>;
  findById(id: string): Promise<StoredStudent | null>;
  findMany(ids: readonly string[]): Promise<StoredStudent[]>;
  setBan(id: string, ban: Ban | null): Promise<StoredStudent | null>;
  /** Os que entraram por último. */
  listRecent(limit: number): Promise<StoredStudent[]>;
  /** Os banidos agora, os mais recentes primeiro. */
  listBanned(now: Date, limit: number): Promise<StoredStudent[]>;
}

/** Porta de saída: as sessões, pelo hash do token. */
export interface StudentSessionRepository {
  create(session: StoredSession): Promise<void>;
  /** A sessão que vale em `now`; `null` sem ela. */
  find(id: string, now: Date): Promise<StoredSession | null>;
  /** Grava o uso e empurra o prazo. */
  touch(id: string, now: Date, expiresAt: Date): Promise<void>;
  remove(id: string): Promise<void>;
}
