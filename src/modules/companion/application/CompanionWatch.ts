import {
  CALL_KINDS,
  canJoin,
  type CallKind,
  type CompanionCall,
} from '../domain/companion';

/** O pedido de "Me avise se abrirem" da conta (o logout apaga). */
export const COMPANION_WATCH_KEY = 'companion-watch';

type Request = {
  kind: CallKind;
  /** Até quando vigiar (a janela livre), em ms. */
  until: number;
  /** As chamadas que o aluno já viu quando pediu: não viram aviso. */
  seen: string[];
};

export type WatchSnapshot = {
  /** Escopo da conta do pedido lido (`null`: ainda não lido). */
  scope: string | null;
  request: { kind: CallKind; until: number } | null;
};

/** O aviso que sai quando alguém abre (o mesmo formato dos outros avisos). */
type WatchNotification = {
  id: string;
  channel: 'companion';
  title: string;
  body: string;
  publicTitle: string;
  publicBody: string;
  target: 'companion';
};

type Dependencies = {
  device: {
    requestPermission(): Promise<'granted' | 'denied' | 'blocked'>;
    notify(content: WatchNotification): Promise<void>;
    /** Liga ou desliga a tarefa do Android a cada 15 minutos. */
    setCompanionWatch(enabled: boolean): Promise<void>;
  };
  store: {
    read<T>(scope: string, key: string): Promise<T | null>;
    write<T>(scope: string, key: string, value: T): Promise<void>;
  };
  account: () => { scope: string } | null | undefined;
  /** Conta salva (keychain), lida sem o portal: a tarefa sem tela usa esta. */
  savedScope: () => Promise<string | null>;
  /** O aviso remoto desligou a Companhia agora. */
  disabled: () => boolean;
  /** A lista do servidor (gasta o passe de uma hora). */
  list: () => Promise<{ calls: readonly CompanionCall[] }>;
  /** As chamadas em que o aluno já está (as dele não viram aviso). */
  memberships: () => Promise<readonly { callId: string }[]>;
  message: (call: CompanionCall, count: number) => WatchNotification;
  now: () => number;
};

function valid(raw: unknown, now: number): raw is Request {
  if (!raw || typeof raw !== 'object') return false;
  const request = raw as Partial<Request>;
  return (
    CALL_KINDS.includes(request.kind as CallKind) &&
    typeof request.until === 'number' &&
    request.until > now &&
    Array.isArray(request.seen) &&
    request.seen.every(id => typeof id === 'string')
  );
}

/**
 * "Me avise se abrirem": com a lista vazia, o aluno pede um aviso para a
 * janela livre dele, em vez de abrir a própria mesa. Com o app na tela, a
 * própria tela mostra quem abriu (e o pedido termina); fora dela, o Android
 * roda a cada 15 minutos uma tarefa que lê a lista e avisa uma vez. Só no
 * Android (no iOS não há tarefa sem tela).
 */
export class CompanionWatch {
  private snapshot: WatchSnapshot = { scope: null, request: null };
  private listeners = new Set<() => void>();

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): WatchSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Lê o pedido da conta ativa (ao abrir a tela ou o Início). */
  async load(): Promise<void> {
    const owner = this.dependencies.account();
    if (!owner) return;
    const raw = await this.dependencies.store
      .read<unknown>(owner.scope, COMPANION_WATCH_KEY)
      .catch(() => null);
    this.publish(owner.scope, valid(raw, this.dependencies.now()) ? raw : null);
  }

  /** Pede o aviso até `until`; sem permissão de notificações, não pede. */
  async request(
    kind: CallKind,
    until: number,
    seen: readonly string[],
  ): Promise<'requested' | 'denied'> {
    const { device, store, account } = this.dependencies;
    const owner = account();
    if (!owner) return 'denied';
    const permission = await device.requestPermission().catch(() => 'denied');
    if (permission !== 'granted') return 'denied';
    const request: Request = { kind, until, seen: [...seen] };
    await store.write<Request>(owner.scope, COMPANION_WATCH_KEY, request);
    await device.setCompanionWatch(true).catch(() => undefined);
    this.publish(owner.scope, request);
    return 'requested';
  }

  async cancel(): Promise<void> {
    const owner = this.dependencies.account();
    if (owner) await this.clear(owner.scope);
  }

  /** A tela já mostra uma chamada do tipo pedido: o pedido terminou. */
  async satisfied(): Promise<void> {
    const owner = this.dependencies.account();
    if (owner && this.snapshot.request) await this.clear(owner.scope);
  }

  /**
   * Tarefa sem tela: com o pedido vigente, lê a lista e avisa uma vez quando
   * abre uma chamada do tipo pedido, na janela, com vaga e que o aluno não
   * viu. Sem pedido (já avisado, vencido, logout), para a tarefa.
   */
  async checkInBackground(): Promise<'notified' | 'waiting' | 'stopped'> {
    const { store, savedScope, device, disabled, list, memberships, now } =
      this.dependencies;
    const scope = await savedScope().catch(() => null);
    const raw = scope
      ? await store.read<unknown>(scope, COMPANION_WATCH_KEY).catch(() => null)
      : null;
    if (!scope || !valid(raw, now()) || disabled()) {
      if (scope) await this.clear(scope);
      else await device.setCompanionWatch(false).catch(() => undefined);
      return 'stopped';
    }
    let calls: readonly CompanionCall[];
    let mine: readonly { callId: string }[];
    try {
      [{ calls }, mine] = await Promise.all([list(), memberships()]);
    } catch {
      // sem rede ou sem token agora: a próxima rodada tenta de novo
      return 'waiting';
    }
    const at = now();
    const fresh = calls
      .filter(
        call =>
          call.kind === raw.kind &&
          call.at <= raw.until &&
          canJoin(call, at) &&
          !raw.seen.includes(call.id) &&
          !mine.some(item => item.callId === call.id),
      )
      .sort((a, b) => a.at - b.at);
    if (!fresh.length) return 'waiting';
    await device
      .notify(this.dependencies.message(fresh[0], fresh.length))
      .catch(() => undefined);
    await this.clear(scope);
    return 'notified';
  }

  private async clear(scope: string) {
    await this.dependencies.store
      .write<Request | null>(scope, COMPANION_WATCH_KEY, null)
      .catch(() => undefined);
    await this.dependencies.device
      .setCompanionWatch(false)
      .catch(() => undefined);
    this.publish(scope, null);
  }

  private publish(scope: string, request: Request | null) {
    this.snapshot = {
      scope,
      request: request ? { kind: request.kind, until: request.until } : null,
    };
    this.listeners.forEach(listener => listener());
  }
}
