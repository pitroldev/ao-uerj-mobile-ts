import { AppError } from '@root/shared/errors/AppError';
import {
  canTryPortal,
  PORTAL_UP,
  portalFailed,
  portalResponded,
  type PortalAvailability,
  type PortalFailure,
} from '../domain/portalAvailability';
import type { SharedPortalStatus } from '../domain/sharedStatus';
import type { SharedPortalStatusPort } from './ports';

export type PortalSnapshot = PortalAvailability & {
  /** Situação vista pelo nosso servidor, lida durante a queda. */
  shared: SharedPortalStatus | null;
  /** Hora desta situação: a referência dos textos ("desde", "nova tentativa às"). */
  observedAt: number;
};

/** Respostas do portal que dizem que ele está fora (gateway e manutenção). */
const UNAVAILABLE_STATUS = [502, 503, 504];

/** O portal respondeu de fato (até um erro dele conta; queda de gateway não). */
export function isPortalAnswer(status: number): boolean {
  return !UNAVAILABLE_STATUS.includes(status);
}
/** Intervalo mínimo entre consultas ao nosso servidor durante uma queda. */
const SHARED_INTERVAL = 2 * 60 * 1000;
/** Intervalo mínimo entre testes do portal pedidos por leituras durante a queda. */
const DEMAND_PROBE_INTERVAL = 30 * 1000;

type Dependencies = {
  now: () => number;
  /** O aparelho tem internet: sem ela, a falha não é do portal. */
  online: () => boolean;
  /** O app está na tela: só então a espera vencida gera nova tentativa. */
  active: () => boolean;
  /**
   * Uma requisição leve ao portal, fora da guarda (a página inicial), que
   * devolve o status HTTP ou falha sem resposta.
   */
  probe: () => Promise<number>;
  shared?: SharedPortalStatusPort;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
};

/**
 * Disjuntor do portal: depois de uma queda (o portal fora com a internet
 * funcionando), as leituras falham na hora até a próxima tentativa, em vez de
 * cada tela esperar o tempo-limite e insistir num portal que já está mal. A
 * tentativa é uma requisição leve; quando ela responde, quem escuta
 * `onRecovered` atualiza as telas.
 */
export class PortalMonitor {
  private snapshot: PortalSnapshot = {
    ...PORTAL_UP,
    shared: null,
    observedAt: 0,
  };
  private listeners = new Set<() => void>();
  private recovered = new Set<() => void>();
  private timer: unknown = null;
  private probing: Promise<void> | null = null;
  private sharedReadAt = 0;
  private demandProbeAt = 0;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (timer: unknown) => void;

  constructor(private readonly dependencies: Dependencies) {
    this.setTimer =
      dependencies.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer =
      dependencies.clearTimer ??
      (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
  }

  getSnapshot = (): PortalSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** O portal voltou depois de uma queda. */
  onRecovered(listener: () => void): () => void {
    this.recovered.add(listener);
    return () => {
      this.recovered.delete(listener);
    };
  }

  /**
   * Antes de cada requisição: com o portal fora e a espera correndo, falha na
   * hora. A leitura pedida (tela aberta, "Tentar novamente", puxar para
   * atualizar) testa o portal com a requisição leve, no máximo a cada 30 s:
   * se ele voltou, `onRecovered` atualiza as telas.
   */
  guard(): void {
    const now = this.dependencies.now();
    if (canTryPortal(this.snapshot, now)) return;
    if (now - this.demandProbeAt >= DEMAND_PROBE_INTERVAL) {
      this.demandProbeAt = now;
      void this.retryNow();
    }
    throw new AppError('SERVICE_UNAVAILABLE');
  }

  /** O portal respondeu (qualquer status que não seja de queda). */
  responded(durationMs: number): void {
    const wasDown = this.snapshot.state === 'down';
    this.stopTimer();
    this.publish({ ...portalResponded(durationMs), shared: null });
    if (wasDown) this.recovered.forEach(listener => listener());
  }

  /** Classifica o status de uma resposta: queda ou resposta. */
  answered(status: number, durationMs: number): void {
    if (isPortalAnswer(status)) this.responded(durationMs);
    else this.failed('unavailable');
  }

  failed(failure: PortalFailure): void {
    if (!this.dependencies.online()) return;
    const now = this.dependencies.now();
    const next = portalFailed(this.snapshot, failure, now);
    this.publish({ ...next, shared: this.snapshot.shared });
    if (next.state === 'down') {
      this.schedule(next.retryAt ?? now);
      void this.refreshShared();
    }
  }

  /** "Tentar agora": uma requisição leve, sem esperar a próxima tentativa. */
  retryNow(): Promise<void> {
    if (this.snapshot.state === 'up') return Promise.resolve();
    this.probing ??= this.probe().finally(() => {
      this.probing = null;
    });
    return this.probing;
  }

  /** O app voltou à tela: tenta se a espera já venceu. */
  resume(): void {
    const { state, retryAt } = this.snapshot;
    if (
      state === 'down' &&
      retryAt !== null &&
      retryAt <= this.dependencies.now()
    )
      void this.retryNow();
  }

  private async probe() {
    const started = this.dependencies.now();
    try {
      const status = await this.dependencies.probe();
      this.answered(status, this.dependencies.now() - started);
    } catch {
      this.failed('network');
    }
  }

  private schedule(at: number) {
    this.stopTimer();
    this.timer = this.setTimer(
      () => {
        this.timer = null;
        if (this.dependencies.active()) this.resume();
      },
      Math.max(0, at - this.dependencies.now()),
    );
  }

  private stopTimer() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private async refreshShared() {
    const { shared, now } = this.dependencies;
    if (!shared || now() - this.sharedReadAt < SHARED_INTERVAL) return;
    this.sharedReadAt = now();
    const status = await shared.read().catch(() => null);
    if (this.snapshot.state === 'down')
      this.publish({ ...this.snapshot, shared: status });
  }

  /** Só avisa quem escuta quando algo muda: cada resposta do portal passa aqui. */
  private publish(snapshot: Omit<PortalSnapshot, 'observedAt'>) {
    const current = this.snapshot;
    const same =
      current.state === snapshot.state &&
      current.since === snapshot.since &&
      current.attempts === snapshot.attempts &&
      current.strikes === snapshot.strikes &&
      current.retryAt === snapshot.retryAt &&
      current.slow === snapshot.slow &&
      current.shared === snapshot.shared;
    if (same) return;
    this.snapshot = { ...snapshot, observedAt: this.dependencies.now() };
    this.listeners.forEach(listener => listener());
  }
}
