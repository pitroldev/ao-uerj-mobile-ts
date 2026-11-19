import type {
  CallKind,
  CallList,
  MemberCall,
  Membership,
  OpenCallRequest,
  PhraseId,
  ReportReason,
} from '../domain/companion';

export type RequestOptions = { signal?: AbortSignal };

export type JoinedCall = { call: MemberCall; memberKey: string };

/**
 * O servidor (pitrol.dev/aouerj/v2/companion). Todo pedido leva a sessão de
 * aluno (o servidor sabe quem está em cada mesa ou grupo); a lista usa
 * também o passe de uma hora, e o resto, a chave de membro. As recusas vêm
 * como `CompanionError`; rede e servidor fora, como `AppError`.
 */
export interface CompanionServerPort {
  /** O passe que lê a lista por uma hora. */
  pass(): Promise<{ pass: string; expiresAt: number }>;
  /**
   * As chamadas e quantos estão de olho; `CompanionError('pass_expired')`
   * com o passe vencido.
   */
  list(pass: string, options?: RequestOptions): Promise<CallList>;
  open(request: OpenCallRequest): Promise<JoinedCall>;
  join(callId: string, name: string): Promise<JoinedCall>;
  read(
    callId: string,
    memberKey: string,
    options?: RequestOptions,
  ): Promise<MemberCall>;
  leave(callId: string, memberKey: string): Promise<void>;
  say(callId: string, memberKey: string, phrase: PhraseId): Promise<MemberCall>;
  /** Quem chamou (pela chave dele) tira alguém pelo apelido. */
  remove(callId: string, memberKey: string, ref: string): Promise<MemberCall>;
  /** Com a chave, conta uma vez por membro; sem ela, uma vez por aluno (a sessão). */
  report(
    callId: string,
    reason: ReportReason,
    memberKey: string | null,
  ): Promise<void>;
}

/** O pedido de "Me avise" guardado no servidor (um por aluno). */
export type ServerWatch = { kind: CallKind; until: number };

/**
 * O "Me avise se tiver mesa" do iPhone (pitrol.dev/aouerj/v2/companion/watch):
 * o iOS não acorda o app a cada 15 minutos, então o servidor guarda o pedido
 * e manda um push quando abre uma chamada do tipo pedido. Tudo com a sessão
 * de aluno; o token do aparelho só existe no servidor enquanto o pedido vale.
 */
export interface CompanionWatchServerPort {
  /** `available`: o servidor manda push (sem a chave da Apple, não). */
  status(): Promise<{ available: boolean; watch: ServerWatch | null }>;
  /** Guarda (ou troca) o pedido; recusas e falhas como `AppError`. */
  put(request: {
    kind: CallKind;
    until: number;
    seen: readonly string[];
    token: string;
  }): Promise<ServerWatch>;
  remove(): Promise<void>;
}

/** As participações, no cofre do aparelho (as chaves são segredos). */
export interface MembershipStorePort {
  read(): Promise<Membership[]>;
  write(memberships: readonly Membership[]): Promise<void>;
}
