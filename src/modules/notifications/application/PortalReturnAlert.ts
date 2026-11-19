import { portalBackMessage } from '../domain/messages';
import type {
  ActiveAccount,
  NotificationDevicePort,
  NotificationStore,
  PortalReturnServerPort,
  RemoteSwitch,
} from './ports';

/** Pedido de aviso da conta (o logout apaga com as outras preferências). */
export const PORTAL_RETURN_KEY = 'portal-return-alert';
/** Um pedido esquecido não fica vigiando o portal para sempre. */
const REQUEST_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

/**
 * `via`: quem vigia. `device`, a tarefa do aparelho (a cada 15 minutos no
 * Android, quando o iOS deixar no iPhone); `push`, o servidor (iPhone).
 * Sem o campo, os pedidos de antes, do aparelho.
 */
type Request = { requestedAt: number; via?: 'device' | 'push' };

type Dependencies = {
  device: Pick<
    NotificationDevicePort,
    'permission' | 'requestPermission' | 'notify' | 'setPortalReturnWatch'
  >;
  /**
   * iPhone: o servidor, que já testa o portal a cada pouco, manda o aviso por
   * push quando o vê de volta. Sem ele (ou se o pedido não sair), vigia a
   * tarefa do aparelho.
   */
  push?: {
    /** O token de push do aparelho; `null` sem ele. */
    token(): Promise<string | null>;
    server: PortalReturnServerPort;
  } | null;
  store: NotificationStore;
  account: () => ActiveAccount | null | undefined;
  /** Conta salva (keychain), lida sem o portal: a tarefa sem tela usa esta. */
  savedScope: () => Promise<string | null>;
  remote: Pick<RemoteSwitch, 'disabled'>;
  /** Uma requisição leve ao portal: `true` se ele respondeu. */
  probe: () => Promise<boolean>;
  now: () => number;
};

export type PortalReturnSnapshot = {
  /** Escopo da conta do pedido lido (`null`: ainda não lido). */
  scope: string | null;
  requested: boolean;
};

function valid(raw: unknown, now: number): raw is Request {
  return (
    !!raw &&
    typeof raw === 'object' &&
    typeof (raw as Request).requestedAt === 'number' &&
    now - (raw as Request).requestedAt <= REQUEST_MAX_AGE
  );
}

/**
 * "Avisar quando voltar": com o portal fora do ar, o aluno pede um aviso. Com
 * o app na tela, quem avisa é a própria tela quando o portal responde; fora
 * dela, uma tarefa que só testa o portal e avisa uma vez: a cada 15 minutos
 * no Android e quando o iOS deixar no iPhone. No iPhone, quem vigia é o
 * servidor, que avisa por push na hora em que vê o portal de volta; a tarefa
 * fica para quando o pedido não chega ao servidor.
 */
export class PortalReturnAlert {
  private snapshot: PortalReturnSnapshot = { scope: null, requested: false };
  private listeners = new Set<() => void>();
  /** Muda a cada pedido e cancelamento: a leitura do servidor que chega depois não desfaz. */
  private revision = 0;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): PortalReturnSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Lê o pedido da conta ativa (ao abrir a tela da queda). O pedido do
   * servidor que já avisou (ou venceu lá) some daqui também.
   */
  async load(): Promise<void> {
    const { account, store, now, push } = this.dependencies;
    const owner = account();
    if (!owner) return;
    const raw = await store
      .read<unknown>(owner.scope, PORTAL_RETURN_KEY)
      .catch(() => null);
    const request = valid(raw, now()) ? raw : null;
    this.publish({ scope: owner.scope, requested: request !== null });
    if (request?.via !== 'push' || !push) return;
    const revision = this.revision;
    const status = await push.server.status().catch(() => null);
    if (
      !status ||
      status.requested ||
      revision !== this.revision ||
      account()?.scope !== owner.scope
    )
      return;
    await this.forget(owner.scope);
  }

  /**
   * Pede o aviso; sem permissão de notificações, não pede. `requestedOnServer`:
   * o servidor vigia e avisa na hora (iPhone); `requested`: a tarefa do
   * aparelho, que no iPhone roda quando o iOS deixar.
   */
  async request(): Promise<'requested' | 'requestedOnServer' | 'denied'> {
    const { device, store, account, now } = this.dependencies;
    const owner = account();
    if (!owner) return 'denied';
    const permission = await device.requestPermission().catch(() => 'denied');
    if (permission !== 'granted') return 'denied';
    const via = (await this.requestPush()) ? 'push' : 'device';
    this.revision += 1;
    await store.write<Request>(owner.scope, PORTAL_RETURN_KEY, {
      requestedAt: now(),
      via,
    });
    if (via === 'device')
      await device.setPortalReturnWatch(true).catch(() => undefined);
    this.publish({ scope: owner.scope, requested: true });
    return via === 'push' ? 'requestedOnServer' : 'requested';
  }

  async cancel(): Promise<void> {
    const owner = this.dependencies.account();
    if (!owner) return;
    await this.clear(owner.scope);
  }

  /** O portal voltou com o app na tela: a própria tela avisa. */
  async portalBack(): Promise<void> {
    const owner = this.dependencies.account();
    if (owner && this.snapshot.requested) await this.clear(owner.scope);
  }

  /**
   * Saída da conta, antes de a sessão de aluno acabar: o pedido sai do
   * servidor. A cópia do aparelho, o logout apaga.
   */
  async signOut(): Promise<void> {
    await this.dependencies.push?.server.cancel().catch(() => undefined);
  }

  /**
   * Tarefa sem tela: com o pedido vigente, testa o portal e avisa uma vez
   * quando ele responde. Sem pedido (já avisado, logout, vencido), para a
   * tarefa. A conta salva que não abre (o Keychain, no iPhone, com a conta
   * gravada antes para abrir só desbloqueado) não é "sem conta": a rodada
   * espera a próxima. O pedido que o servidor vigia não é desta tarefa.
   */
  async checkInBackground(): Promise<'notified' | 'waiting' | 'stopped'> {
    const { store, savedScope, remote, probe, device, now } = this.dependencies;
    let scope: string | null;
    try {
      scope = await savedScope();
    } catch {
      return 'waiting';
    }
    const raw = scope
      ? await store.read<unknown>(scope, PORTAL_RETURN_KEY).catch(() => null)
      : null;
    if (
      !scope ||
      !valid(raw, now()) ||
      raw.via === 'push' ||
      remote.disabled()
    ) {
      await device.setPortalReturnWatch(false).catch(() => undefined);
      return 'stopped';
    }
    if (!(await probe().catch(() => false))) return 'waiting';
    await device.notify(portalBackMessage()).catch(() => undefined);
    await this.clear(scope);
    return 'notified';
  }

  /** O pedido vai ao servidor com o token de push; `false` se não foi. */
  private async requestPush(): Promise<boolean> {
    const { push } = this.dependencies;
    if (!push) return false;
    const token = await push.token().catch(() => null);
    if (!token) return false;
    try {
      await push.server.request(token);
      return true;
    } catch {
      return false;
    }
  }

  /** O pedido acaba: no servidor (iPhone) e no aparelho. */
  private async clear(scope: string) {
    this.revision += 1;
    const raw = await this.dependencies.store
      .read<unknown>(scope, PORTAL_RETURN_KEY)
      .catch(() => null);
    // sem rede, o pedido do servidor fica até vencer: avisa uma vez, no máximo
    if (raw && (raw as Request).via === 'push')
      await this.dependencies.push?.server.cancel().catch(() => undefined);
    await this.forget(scope);
  }

  /** Só a cópia do aparelho (e a tarefa). */
  private async forget(scope: string) {
    await this.dependencies.store
      .write<Request | null>(scope, PORTAL_RETURN_KEY, null)
      .catch(() => undefined);
    await this.dependencies.device
      .setPortalReturnWatch(false)
      .catch(() => undefined);
    this.publish({ scope, requested: false });
  }

  private publish(snapshot: PortalReturnSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
}
