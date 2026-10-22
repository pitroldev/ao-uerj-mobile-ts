import { portalBackMessage } from '../domain/messages';
import type {
  ActiveAccount,
  NotificationDevicePort,
  NotificationStore,
  RemoteSwitch,
} from './ports';

/** Pedido de aviso da conta (o logout apaga com as outras preferências). */
export const PORTAL_RETURN_KEY = 'portal-return-alert';
/** Um pedido esquecido não fica vigiando o portal para sempre. */
const REQUEST_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

type Request = { requestedAt: number };

type Dependencies = {
  device: Pick<
    NotificationDevicePort,
    'permission' | 'requestPermission' | 'notify' | 'setPortalReturnWatch'
  >;
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
 * dela, o Android roda uma tarefa a cada 15 minutos que só testa o portal e
 * avisa uma vez.
 */
export class PortalReturnAlert {
  private snapshot: PortalReturnSnapshot = { scope: null, requested: false };
  private listeners = new Set<() => void>();

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): PortalReturnSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Lê o pedido da conta ativa (ao abrir a tela da queda). */
  async load(): Promise<void> {
    const account = this.dependencies.account();
    if (!account) return;
    const raw = await this.dependencies.store
      .read<unknown>(account.scope, PORTAL_RETURN_KEY)
      .catch(() => null);
    this.publish({
      scope: account.scope,
      requested: valid(raw, this.dependencies.now()),
    });
  }

  /** Pede o aviso; sem permissão de notificações, não pede. */
  async request(): Promise<'requested' | 'denied'> {
    const { device, store, account, now } = this.dependencies;
    const owner = account();
    if (!owner) return 'denied';
    const permission = await device.requestPermission().catch(() => 'denied');
    if (permission !== 'granted') return 'denied';
    await store.write<Request>(owner.scope, PORTAL_RETURN_KEY, {
      requestedAt: now(),
    });
    await device.setPortalReturnWatch(true).catch(() => undefined);
    this.publish({ scope: owner.scope, requested: true });
    return 'requested';
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
   * Tarefa sem tela: com o pedido vigente, testa o portal e avisa uma vez
   * quando ele responde. Sem pedido (já avisado, logout, vencido), para a
   * tarefa.
   */
  async checkInBackground(): Promise<'notified' | 'waiting' | 'stopped'> {
    const { store, savedScope, remote, probe, device, now } = this.dependencies;
    const scope = await savedScope().catch(() => null);
    const raw = scope
      ? await store.read<unknown>(scope, PORTAL_RETURN_KEY).catch(() => null)
      : null;
    if (!scope || !valid(raw, now()) || remote.disabled()) {
      await device.setPortalReturnWatch(false).catch(() => undefined);
      return 'stopped';
    }
    if (!(await probe().catch(() => false))) return 'waiting';
    await device.notify(portalBackMessage()).catch(() => undefined);
    await this.clear(scope);
    return 'notified';
  }

  private async clear(scope: string) {
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
