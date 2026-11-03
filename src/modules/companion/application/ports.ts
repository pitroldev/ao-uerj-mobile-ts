import type {
  CompanionCall,
  MemberCall,
  Membership,
  OpenCallRequest,
  PhraseId,
  ReportReason,
} from '../domain/companion';

export type RequestOptions = { signal?: AbortSignal };

export type JoinedCall = { call: MemberCall; memberKey: string };

/**
 * O servidor (pitrol.dev/aouerj/v2/companion). Abrir, entrar, pedir o passe
 * e denunciar de fora gastam um token anônimo de aluno; a lista usa o passe
 * de uma hora; o resto, a chave de membro. As recusas vêm como
 * `CompanionError`; rede e servidor fora, como `AppError`.
 */
export interface CompanionServerPort {
  /** Gasta um token: o passe que lê a lista por uma hora. */
  pass(): Promise<{ pass: string; expiresAt: number }>;
  /** `CompanionError('pass_expired')` com o passe vencido. */
  list(pass: string, options?: RequestOptions): Promise<CompanionCall[]>;
  open(request: OpenCallRequest): Promise<JoinedCall>;
  join(callId: string, name: string): Promise<JoinedCall>;
  read(
    callId: string,
    memberKey: string,
    options?: RequestOptions,
  ): Promise<MemberCall>;
  leave(callId: string, memberKey: string): Promise<void>;
  say(callId: string, memberKey: string, phrase: PhraseId): Promise<MemberCall>;
  /** Com a chave, conta uma vez por membro; sem ela, gasta um token. */
  report(
    callId: string,
    reason: ReportReason,
    memberKey: string | null,
  ): Promise<void>;
}

/** As participações, no cofre do aparelho (as chaves são segredos). */
export interface MembershipStorePort {
  read(): Promise<Membership[]>;
  write(memberships: readonly Membership[]): Promise<void>;
}
