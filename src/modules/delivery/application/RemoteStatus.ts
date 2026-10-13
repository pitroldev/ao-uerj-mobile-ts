import { parseAppStatus, type AppStatus } from '../domain/appStatus';
import type { AppKeyValueStore, AppStatusSource } from './ports';

export const APP_STATUS_KEY = 'app-status';
export const DISMISSED_NOTICES_KEY = 'dismissed-notices';
/** Intervalo mínimo entre buscas (a abertura e a volta ao primeiro plano pedem). */
export const REFRESH_INTERVAL = 15 * 60 * 1000;

export type RemoteStatusSnapshot = {
  /** Última cópia válida (da rede ou salva); `null` antes da primeira. */
  status: AppStatus | null;
  dismissed: ReadonlySet<string>;
};

type Dependencies = {
  source: AppStatusSource;
  store: AppKeyValueStore;
  now: () => number;
};

/**
 * Aviso remoto: mostra a última cópia boa salva e busca a nova sem bloquear.
 * Falha de rede, tempo esgotado e JSON inválido mantêm a cópia atual.
 */
export class RemoteStatus {
  private snapshot: RemoteStatusSnapshot = {
    status: null,
    dismissed: new Set(),
  };
  private listeners = new Set<() => void>();
  private starting: Promise<void> | null = null;
  private fetching: Promise<void> | null = null;
  private lastAttemptAt = -Infinity;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): RemoteStatusSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(snapshot: RemoteStatusSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  /** Na abertura: cópia salva primeiro, depois a rede. Idempotente. */
  start(): Promise<void> {
    this.starting ??= this.restore().then(() => this.refresh());
    return this.starting;
  }

  /** Busca de novo, respeitando o intervalo mínimo desde a última tentativa. */
  refresh(): Promise<void> {
    if (this.fetching) return this.fetching;
    const now = this.dependencies.now();
    if (now - this.lastAttemptAt < REFRESH_INTERVAL) return Promise.resolve();
    this.lastAttemptAt = now;
    this.fetching = this.fetchLatest().finally(() => {
      this.fetching = null;
    });
    return this.fetching;
  }

  /** Esconde o aviso de vez (guarda só os ids que ainda estão no documento). */
  async dismiss(id: string): Promise<void> {
    if (this.snapshot.dismissed.has(id)) return;
    const dismissed = new Set(this.snapshot.dismissed).add(id);
    this.publish({ ...this.snapshot, dismissed });
    const current = new Set(this.snapshot.status?.notices.map(n => n.id));
    await this.dependencies.store
      .write(
        DISMISSED_NOTICES_KEY,
        [...dismissed].filter(item => item === id || current.has(item)),
      )
      .catch(() => undefined);
  }

  private async restore() {
    const { store } = this.dependencies;
    const [saved, dismissed] = await Promise.all([
      store.read<unknown>(APP_STATUS_KEY).catch(() => null),
      store.read<unknown>(DISMISSED_NOTICES_KEY).catch(() => null),
    ]);
    const ids = Array.isArray(dismissed)
      ? dismissed.filter((id): id is string => typeof id === 'string')
      : [];
    this.publish({
      // a rede pode ter respondido primeiro (refresh antes do start)
      status: this.snapshot.status ?? parseAppStatus(saved),
      dismissed: new Set([...this.snapshot.dismissed, ...ids]),
    });
  }

  private async fetchLatest() {
    let status: AppStatus | null;
    try {
      status = parseAppStatus(await this.dependencies.source.fetch());
    } catch {
      return;
    }
    if (!status) return;
    this.publish({ ...this.snapshot, status });
    await this.dependencies.store
      .write(APP_STATUS_KEY, status)
      .catch(() => undefined);
  }
}
