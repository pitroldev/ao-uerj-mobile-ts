import {
  CompanionError,
  isCurrent,
  membershipOf,
  type CallList,
  type MemberCall,
  type Membership,
  type OpenCallRequest,
  type PhraseId,
  type ReportReason,
} from '../domain/companion';
import type {
  CompanionServerPort,
  MembershipStorePort,
  RequestOptions,
} from './ports';

type Dependencies = {
  server: CompanionServerPort;
  /** `null` sem o cofre: sem onde guardar as chaves, não há Companhia. */
  store: MembershipStorePort | null;
  now: () => number;
};

/** Preferência da conta: o primeiro nome que o aluno escolheu mostrar. */
export const COMPANION_NAME_KEY = 'companion-name';

/** Preferência da conta: o dia em que o aluno tocou "Agora não" no convite do Início. */
export const COMPANION_INVITE_KEY = 'companion-invite';

/** O passe é trocado um minuto antes de vencer. */
const PASS_MARGIN_MS = 60 * 1000;

const NONE: readonly Membership[] = [];

/**
 * A chamada já não existe para esta chave (acabou, outra instalação, quem
 * chamou tirou a pessoa): a participação se apaga.
 */
const isGone = (error: unknown) =>
  error instanceof CompanionError &&
  (error.refusal === 'gone' ||
    error.refusal === 'not_member' ||
    error.refusal === 'removed');

/**
 * A Companhia agora no app: a lista (com o passe de uma hora), abrir,
 * entrar, recados, sair e denunciar, tudo com a sessão de aluno. As
 * participações ficam no cofre, com a chave de membro de cada uma; cada
 * pessoa tem uma aberta por vez (abrir outra encerra a anterior).
 */
export class CompanionCalls {
  private pass: { value: string; expiresAt: number } | null = null;
  private passing: Promise<string> | null = null;
  private memberships: readonly Membership[] = NONE;
  private loaded: Promise<void> | null = null;
  /** O cofre já foi lido: daqui em diante, a cópia em memória manda. */
  private hydrated = false;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  /**
   * As chamadas denunciadas de fora nesta sessão: a mesma pessoa não
   * denuncia de novo (o servidor também conta uma por aluno).
   */
  private reported = new Set<string>();
  /** As chamadas de que quem chamou tirou o aluno: o botão de entrar some. */
  private removedFrom = new Set<string>();

  constructor(private readonly dependencies: Dependencies) {}

  /** O aparelho guarda as chaves (o cofre): sem ele, a tela explica. */
  get supported(): boolean {
    return this.dependencies.store !== null;
  }

  /** As participações que ainda valem, para o Início e os lembretes. */
  getSnapshot = (): readonly Membership[] => this.memberships;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Lê o cofre uma vez (o resto do app espera esta leitura). */
  load(): Promise<void> {
    this.loaded ??= this.change(current => current);
    return this.loaded;
  }

  /** A participação nesta chamada, se houver. */
  membership(callId: string): Membership | undefined {
    return this.memberships.find(item => item.callId === callId);
  }

  async list(options?: RequestOptions): Promise<CallList> {
    const { server } = this.dependencies;
    for (let attempt = 1; ; attempt++) {
      const pass = await this.currentPass();
      try {
        return await server.list(pass, options);
      } catch (error) {
        const expired =
          error instanceof CompanionError && error.refusal === 'pass_expired';
        if (!expired || attempt === 2) throw error;
        this.pass = null;
      }
    }
  }

  async open(request: OpenCallRequest): Promise<MemberCall> {
    await this.load();
    const { server, now } = this.dependencies;
    // uma chamada aberta por vez: a anterior é encerrada antes
    const previous = this.memberships.filter(
      item => item.host && isCurrent(item, now()),
    );
    for (const item of previous)
      await server.leave(item.callId, item.memberKey).catch(() => undefined);
    const joined = await server.open(request);
    await this.change(current => [
      ...current.filter(item => !previous.includes(item)),
      membershipOf(joined.call, joined.memberKey, true),
    ]);
    return joined.call;
  }

  async join(callId: string, name: string): Promise<MemberCall> {
    await this.load();
    const existing = this.membership(callId);
    if (existing) return this.read(callId);
    const joined = await this.dependencies.server.join(callId, name);
    await this.change(current => [
      ...current,
      membershipOf(joined.call, joined.memberKey, false),
    ]);
    return joined.call;
  }

  /** A chamada como quem está dentro a vê; sem participação, `not_member`. */
  async read(callId: string, options?: RequestOptions): Promise<MemberCall> {
    await this.load();
    const membership = this.membership(callId);
    if (!membership) throw new CompanionError('not_member');
    try {
      return await this.dependencies.server.read(
        callId,
        membership.memberKey,
        options,
      );
    } catch (error) {
      await this.lost(callId, error);
      throw error;
    }
  }

  /** Sai (quem chamou encerra para todos); a participação se apaga. */
  async leave(callId: string): Promise<void> {
    await this.load();
    const membership = this.membership(callId);
    if (!membership) return;
    try {
      await this.dependencies.server.leave(callId, membership.memberKey);
    } catch (error) {
      // a chamada já acabou: não há do que sair
      if (!isGone(error)) throw error;
    }
    await this.forget(callId);
  }

  async say(callId: string, phrase: PhraseId): Promise<MemberCall> {
    await this.load();
    const membership = this.membership(callId);
    if (!membership) throw new CompanionError('not_member');
    try {
      return await this.dependencies.server.say(
        callId,
        membership.memberKey,
        phrase,
      );
    } catch (error) {
      await this.lost(callId, error);
      throw error;
    }
  }

  /** Quem chamou tira alguém da chamada pelo apelido (`ref`). */
  async remove(callId: string, ref: string): Promise<MemberCall> {
    await this.load();
    const membership = this.membership(callId);
    if (!membership?.host) throw new CompanionError('not_host');
    try {
      return await this.dependencies.server.remove(
        callId,
        membership.memberKey,
        ref,
      );
    } catch (error) {
      await this.lost(callId, error);
      throw error;
    }
  }

  /** Denuncia de dentro (pela chave) ou de fora (pela sessão). */
  async report(callId: string, reason: ReportReason): Promise<void> {
    await this.load();
    const membership = this.membership(callId);
    await this.dependencies.server.report(
      callId,
      reason,
      membership?.memberKey ?? null,
    );
    if (!membership) this.reported.add(callId);
  }

  /** Já denunciou esta chamada de fora, nesta sessão do app. */
  hasReported(callId: string): boolean {
    return this.reported.has(callId);
  }

  /** Quem chamou tirou o aluno desta chamada (vale nesta sessão do app). */
  wasRemoved(callId: string): boolean {
    return this.removedFrom.has(callId);
  }

  /** A chamada não vale mais para esta chave: a participação se apaga. */
  private async lost(callId: string, error: unknown): Promise<void> {
    if (!isGone(error)) return;
    if (error instanceof CompanionError && error.refusal === 'removed')
      this.removedFrom.add(callId);
    await this.forget(callId);
  }

  /** Esquece a participação, sem falar com o servidor (encerrada, vencida). */
  forget(callId: string): Promise<void> {
    return this.change(current =>
      current.filter(item => item.callId !== callId),
    );
  }

  /**
   * O logout: sai de cada chamada (a chave e a sessão, que ainda vale) e apaga tudo. Uma
   * falha de rede não impede o logout.
   */
  async clear(): Promise<void> {
    await this.load();
    const { server } = this.dependencies;
    await Promise.all(
      this.memberships.map(item =>
        server.leave(item.callId, item.memberKey).catch(() => undefined),
      ),
    );
    this.pass = null;
    await this.change(() => []);
  }

  private async currentPass(): Promise<string> {
    const { now, server } = this.dependencies;
    if (this.pass && this.pass.expiresAt - PASS_MARGIN_MS > now())
      return this.pass.value;
    this.passing ??= server
      .pass()
      .then(({ pass, expiresAt }) => {
        this.pass = { value: pass, expiresAt };
        return pass;
      })
      .finally(() => {
        this.passing = null;
      });
    return this.passing;
  }

  /** Lê, muda e grava, uma mudança por vez; tira as que venceram. */
  private change(
    update: (current: readonly Membership[]) => readonly Membership[],
  ): Promise<void> {
    const { store, now } = this.dependencies;
    const task = this.queue.then(async () => {
      const saved = this.hydrated ? this.memberships : await readStore(store);
      this.hydrated = true;
      const next = update(saved).filter(item => isCurrent(item, now()));
      const changed =
        next.length !== saved.length ||
        next.some((item, index) => item !== saved[index]);
      if (changed && store) await store.write(next);
      const value = next.length ? next : NONE;
      if (value !== this.memberships) {
        this.memberships = value;
        this.listeners.forEach(listener => listener());
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}

async function readStore(
  store: MembershipStorePort | null,
): Promise<readonly Membership[]> {
  if (!store) return NONE;
  try {
    return await store.read();
  } catch {
    return NONE;
  }
}
