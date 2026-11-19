import type { StudentActor } from '../students/ports.ts';
import type {
  Call,
  CallKind,
  CallReport,
  CallRequest,
  CallWatch,
  CallWatchView,
  DayStats,
  FeedEntry,
  HourStatKey,
  Member,
  MemberCall,
  PhraseId,
  PublicCall,
  PushDevice,
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

/** O "Me avise se abrirem" de quem pede: o pedido e o aparelho. */
export type WatchRequest = {
  kind: CallKind;
  until: Date;
  seen: string[];
  device: PushDevice;
};

/**
 * O pedido do aluno e se o aviso chega (`available`: o servidor manda push
 * para o iPhone).
 */
export type WatchStatus = { available: boolean; watch: CallWatchView | null };

/** Porta de entrada: a Companhia agora. */
export interface Companion {
  /**
   * As chamadas na lista agora, da mais próxima à mais distante. Com
   * `viewer` (o hash do passe), quem olha entra na contagem de "de olho".
   */
  list(viewer?: string | null): Promise<CallList>;
  /**
   * Com `actor` (a sessão do aluno), o membro guarda o aluno: uma pessoa
   * abre uma chamada por vez, entra uma vez em cada uma, e quem foi tirado
   * não volta com outro aparelho.
   */
  open(request: CallRequest, actor?: StudentActor | null): Promise<Membership>;
  join(
    callId: string,
    name: string,
    actor?: StudentActor | null,
  ): Promise<Membership>;
  /**
   * As de chave de membro: a participação de um aluno identificado só vale
   * com a sessão dele (a chave sozinha não basta).
   */
  read(
    callId: string,
    memberKey: Buffer,
    actor?: StudentActor | null,
  ): Promise<MemberCall>;
  /** Quem chamou e sai encerra a chamada para todos. */
  leave(
    callId: string,
    memberKey: Buffer,
    actor?: StudentActor | null,
  ): Promise<void>;
  say(
    callId: string,
    memberKey: Buffer,
    phrase: PhraseId,
    actor?: StudentActor | null,
  ): Promise<MemberCall>;
  /** Quem chamou tira alguém da chamada pelo apelido (`ref`). */
  remove(
    callId: string,
    hostKey: Buffer,
    ref: string,
    actor?: StudentActor | null,
  ): Promise<MemberCall>;
  report(
    callId: string,
    reporter: Reporter,
    reason: ReportReason,
    actor?: StudentActor | null,
  ): Promise<void>;
  /**
   * O aluno foi banido: as chamadas que ele abriu acabam, e ele sai das
   * outras na hora.
   */
  dropStudent(studentId: string): Promise<void>;
  /** Para a moderação: as denúncias mais recentes primeiro. */
  reportsForReview(limit: number): Promise<CallReport[]>;
  /** A moderação tira do ar uma chamada denunciada. */
  hideByModerator(callId: string): Promise<ModerationResult>;
  /** Os números dos últimos `days` dias, do mais novo ao mais antigo. */
  statsForReview(days: number): Promise<DayStats[]>;
  /** O "Me avise se abrirem" do aluno, se ainda vale. */
  watchStatus(actor: StudentActor): Promise<WatchStatus>;
  /**
   * Pede o aviso da próxima chamada do tipo até `until`; o novo pedido fica
   * no lugar do antigo (um por aluno).
   */
  watch(actor: StudentActor, request: WatchRequest): Promise<CallWatchView>;
  unwatch(actor: StudentActor): Promise<void>;
  /**
   * Manda o aviso de cada pedido que já tem uma chamada, um aviso por
   * pedido, e diz quantos chegaram à Apple. Quem abre uma chamada dispara na
   * hora; o agendador, a cada minuto (a chamada aberta com horas de
   * antecedência só aparece na lista uma hora antes, e uma vaga pode abrir).
   */
  deliverWatches(): Promise<number>;
}

/** Porta de saída: onde as chamadas ficam até sumir. */
export interface CallRepository {
  create(call: Call): Promise<void>;
  /** As que estão na lista em `now`. */
  listListed(now: Date): Promise<Call[]>;
  /** Quantas ainda valem em `now` (o teto do campus). */
  countAlive(now: Date): Promise<number>;
  /** As que ainda valem em `now` com o aluno entre os membros. */
  listAliveWith(student: string, now: Date): Promise<Call[]>;
  /** A chamada que ainda vale (não venceu, não saiu do ar); `null` sem ela. */
  find(callId: string, now: Date): Promise<Call | null>;
  /**
   * Põe o membro se a chamada estiver na lista e com vaga e, se ele for um
   * aluno, se não estiver lá nem tiver sido tirado, tudo de uma vez só (duas
   * pessoas não ficam com a última vaga, e o mesmo aluno não entra duas
   * vezes); `null` se não entrou.
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

/**
 * Porta de saída: os pedidos de "Me avise se abrirem", um por aluno, até
 * vencerem. Não confundir com `WatcherRepository`, a contagem de "de olho".
 */
export interface CallWatchRepository {
  /** Grava o pedido do aluno no lugar do que houver. */
  put(watch: CallWatch): Promise<void>;
  /** O pedido do aluno que ainda vale em `now`; `null` sem ele. */
  find(student: string, now: Date): Promise<CallWatch | null>;
  /** Os pedidos que ainda valem em `now`. */
  listActive(now: Date): Promise<CallWatch[]>;
  /**
   * Apaga o pedido se ele ainda for o mesmo (o mesmo `createdAt`), de uma vez
   * só: dois envios ao mesmo tempo não mandam dois avisos. `false` se outro
   * já o levou ou o aluno fez outro pedido.
   */
  claim(watch: CallWatch): Promise<boolean>;
  /** Devolve o pedido cujo aviso não chegou, se o aluno não fez outro. */
  restore(watch: CallWatch): Promise<void>;
  remove(student: string): Promise<void>;
}

/** Um aviso no aparelho do aluno. */
export type PushMessage = {
  title: string;
  body: string;
  /** Agrupa os avisos no aparelho (`thread-id`). */
  thread: string;
  /** O aviso novo com a mesma chave fica no lugar do anterior. */
  collapseId: string;
  /** Para onde o toque leva no app. */
  target: 'companion';
  /** Depois disso, quem estava sem sinal já não recebe. */
  expiresAt: Date;
};

/**
 * `sent`: a Apple aceitou. `gone`: o aparelho não recebe mais por esse token
 * (o app saiu, o token mudou). `failed`: não deu agora (rede, a Apple, a
 * chave), e outro envio pode dar.
 */
export type PushResult = 'sent' | 'gone' | 'failed';

/** Porta de saída: o push para o aparelho (o APNs, no iPhone). */
export interface PushSender {
  send(device: PushDevice, message: PushMessage): Promise<PushResult>;
  /** Fecha a conexão no desligamento. */
  close?(): Promise<void>;
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
