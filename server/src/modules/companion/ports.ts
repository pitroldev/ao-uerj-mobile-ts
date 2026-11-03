import type {
  Call,
  CallReport,
  CallRequest,
  FeedEntry,
  Member,
  MemberCall,
  PhraseId,
  PublicCall,
  ReportReason,
} from './domain.ts';

/** Quem entrou ou abriu recebe a chave de membro, que vale só nesta chamada. */
export type Membership = { call: MemberCall; memberKey: Buffer };

/** Quem denuncia: alguém da chamada (pela chave) ou um aluno de fora. */
export type Reporter = { memberKey: Buffer } | { outsider: true };

/** Porta de entrada: a Companhia agora. */
export interface Companion {
  /** As chamadas na lista agora, da mais próxima à mais distante. */
  list(): Promise<PublicCall[]>;
  open(request: CallRequest): Promise<Membership>;
  join(callId: string, name: string): Promise<Membership>;
  read(callId: string, memberKey: Buffer): Promise<MemberCall>;
  /** Quem chamou e sai encerra a chamada para todos. */
  leave(callId: string, memberKey: Buffer): Promise<void>;
  say(callId: string, memberKey: Buffer, phrase: PhraseId): Promise<MemberCall>;
  report(
    callId: string,
    reporter: Reporter,
    reason: ReportReason,
  ): Promise<void>;
  /** Para a moderação: as denúncias mais recentes primeiro. */
  reportsForReview(limit: number): Promise<CallReport[]>;
}

/** Porta de saída: onde as chamadas ficam até sumir. */
export interface CallRepository {
  create(call: Call): Promise<void>;
  /** As que estão na lista em `now`. */
  listListed(now: Date): Promise<Call[]>;
  /** Quantas ainda valem em `now` (o teto do campus). */
  countAlive(now: Date): Promise<number>;
  /** A chamada que ainda vale (não venceu, não saiu do ar); `null` sem ela. */
  find(callId: string, now: Date): Promise<Call | null>;
  /**
   * Põe o membro se a chamada estiver na lista e com vaga, de uma vez só
   * (duas pessoas não ficam com a última vaga); `null` se não entrou.
   */
  addMember(callId: string, member: Member, now: Date): Promise<Call | null>;
  removeMember(callId: string, member: string): Promise<void>;
  end(callId: string, now: Date): Promise<void>;
  /** Mais um recado de um membro, guardando só os `keep` mais recentes. */
  addFeed(
    callId: string,
    entry: FeedEntry,
    keep: number,
    now: Date,
  ): Promise<Call | null>;
  /** Conta a denúncia uma vez por quem denuncia; `null` se já contava. */
  addReporter(
    callId: string,
    reporter: string,
    now: Date,
  ): Promise<Call | null>;
  hide(callId: string, now: Date): Promise<void>;
}

/** Porta de saída: as denúncias, guardadas para a moderação. */
export interface CallReportRepository {
  create(report: Omit<CallReport, 'id'>): Promise<void>;
  listRecent(limit: number): Promise<CallReport[]>;
}
