import type {
  Call,
  CallReport,
  CallRequest,
  DayStats,
  FeedEntry,
  HourStatKey,
  Member,
  MemberCall,
  PhraseId,
  PublicCall,
  ReportReason,
  StatKey,
} from './domain.ts';

/** Quem entrou ou abriu recebe a chave de membro, que vale só nesta chamada. */
export type Membership = { call: MemberCall; memberKey: Buffer };

/** Quem denuncia: alguém da chamada (pela chave) ou um aluno de fora. */
export type Reporter = { memberKey: Buffer } | { outsider: true };

/**
 * A lista: as chamadas e quantos alunos olharam a lista nos últimos 15
 * minutos (contando quem pergunta), sem saber quem.
 */
export type CallList = { calls: PublicCall[]; watching: number };

/** O que a moderação conseguiu ao tirar uma chamada do ar. */
export type ModerationResult = 'hidden' | 'gone';

/** Porta de entrada: a Companhia agora. */
export interface Companion {
  /**
   * As chamadas na lista agora, da mais próxima à mais distante. Com
   * `viewer` (o hash do passe), quem olha entra na contagem de "de olho".
   */
  list(viewer?: string | null): Promise<CallList>;
  open(request: CallRequest): Promise<Membership>;
  join(callId: string, name: string): Promise<Membership>;
  read(callId: string, memberKey: Buffer): Promise<MemberCall>;
  /** Quem chamou e sai encerra a chamada para todos. */
  leave(callId: string, memberKey: Buffer): Promise<void>;
  say(callId: string, memberKey: Buffer, phrase: PhraseId): Promise<MemberCall>;
  /** Quem chamou tira alguém da chamada pelo apelido (`ref`). */
  remove(callId: string, hostKey: Buffer, ref: string): Promise<MemberCall>;
  report(
    callId: string,
    reporter: Reporter,
    reason: ReportReason,
  ): Promise<void>;
  /** Para a moderação: as denúncias mais recentes primeiro. */
  reportsForReview(limit: number): Promise<CallReport[]>;
  /** A moderação tira do ar uma chamada denunciada. */
  hideByModerator(callId: string): Promise<ModerationResult>;
  /** Os números dos últimos `days` dias, do mais novo ao mais antigo. */
  statsForReview(days: number): Promise<DayStats[]>;
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
  /** Tira o membro e guarda o id dele em `removed`. */
  expel(callId: string, member: string): Promise<void>;
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
  /** Marca a primeira vez (duas pessoas, "Cheguei no ponto"); `false` se já tinha. */
  mark(
    callId: string,
    field: 'filledAt' | 'arrivedAt',
    now: Date,
  ): Promise<boolean>;
}

/** Porta de saída: as denúncias, guardadas para a moderação. */
export interface CallReportRepository {
  create(report: Omit<CallReport, 'id'>): Promise<void>;
  listRecent(limit: number): Promise<CallReport[]>;
  /** As denúncias da chamada passam a dizer que ela saiu do ar. */
  markHidden(callId: string): Promise<void>;
}

/** Porta de saída: as contagens do dia, só números. */
export interface CompanionStatsRepository {
  add(
    day: string,
    counts: Partial<Record<StatKey | HourStatKey, number>>,
    until: Date,
  ): Promise<void>;
  listRecent(days: number): Promise<DayStats[]>;
}

/** Porta de saída: quem olhou a lista há pouco, pelo hash do passe. */
export interface WatcherRepository {
  /**
   * Anota que `viewer` olhou agora e vale até `until`; `true` se ele não
   * contava (chegou agora à lista).
   */
  see(viewer: string, now: Date, until: Date): Promise<boolean>;
  /** Quantos ainda contam em `now`. */
  count(now: Date): Promise<number>;
}
