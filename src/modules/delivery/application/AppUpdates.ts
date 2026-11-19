import {
  chooseUpdate,
  FLEXIBLE_AFTER_DAYS,
  FLEXIBLE_PROMPT_INTERVAL,
  type AppUpdate,
} from '../domain/updatePolicy';
import {
  IDLE_DOWNLOAD,
  updateDownload,
  type DownloadEvent,
  type UpdateDownload,
} from '../domain/updateDownload';
import type {
  AppKeyValueStore,
  AppUpdatesPort,
  InstallProgress,
  StoreListingPort,
  UpdateFlowResult,
} from './ports';

export const FLEXIBLE_PROMPT_KEY = 'flexible-update-prompted-at';
/** A versão da loja que o aluno dispensou no Início ("Agora não"). */
const OFFER_DISMISSED_KEY = 'store-update-dismissed';

export type UpdateSnapshot = UpdateDownload & {
  /**
   * A loja respondeu que não há versão mais nova para este aparelho (rollout
   * parcial, versão ainda não promovida para produção, aparelho fora dos
   * requisitos dela). `false` enquanto ela não responde e onde não há como
   * perguntar.
   */
  storeUpToDate: boolean;
  /** A versão mais nova na loja, quando ela diz qual (a App Store); senão `null`. */
  storeVersion: string | null;
  /**
   * A versão nova que o Início oferece, onde a loja não instala dentro do app
   * (a App Store): há alguns dias na loja e não dispensada. Senão `null`.
   */
  offer: string | null;
};

type Dependencies = {
  /** `null` onde não há como perguntar à loja (app fora dela, testes). */
  updates: AppUpdatesPort | null;
  storeListing: StoreListingPort;
  store: AppKeyValueStore;
  now: () => number;
};

/** Próximo passo do "Atualizar", decidido na fila. */
type UpdateNowStep =
  | { kind: 'install' }
  | { kind: 'flow'; result: Promise<UpdateFlowResult> }
  | { kind: 'storeListing' };

const isUpToDate = (update: AppUpdate) =>
  update.availability === 'none' && update.installStatus !== 'downloaded';

/**
 * Atualizações pela loja. A checagem nunca lança: fora da loja (debug,
 * emulador) ou sem rede ela simplesmente não encontra nada. Na Play, abre os
 * fluxos de atualização dentro do app; na App Store, que não tem esses
 * fluxos, oferece a versão nova no Início e o "Atualizar" abre a loja.
 */
export class AppUpdates {
  private snapshot: UpdateSnapshot = {
    ...IDLE_DOWNLOAD,
    storeUpToDate: false,
    storeVersion: null,
    offer: null,
  };
  /** Eventos da loja invalidam respostas atrasadas da tela de consentimento. */
  private downloadRevision = 0;
  private listeners = new Set<() => void>();
  private checks: Promise<unknown> = Promise.resolve();
  private flexibleAsked = false;
  private immediateAsked = false;
  /** Último fluxo imediato aberto (a resposta da loja, talvez pendente). */
  private lastImmediate: Promise<UpdateFlowResult> | null = null;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): UpdateSnapshot => this.snapshot;

  /** Há como atualizar daqui (loja dentro do app ou página da loja)? */
  get canUpdate(): boolean {
    return (
      this.dependencies.updates !== null ||
      this.dependencies.storeListing.available
    );
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: UpdateSnapshot) {
    const keys = Object.keys(next) as (keyof UpdateSnapshot)[];
    if (keys.every(key => next[key] === this.snapshot[key])) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  private transition(event: DownloadEvent) {
    this.publish({ ...this.snapshot, ...updateDownload(this.snapshot, event) });
  }

  /** Acompanha o download da flexível; devolve a função que para. */
  listen(): () => void {
    return (
      this.dependencies.updates?.onInstallProgress(progress =>
        this.onProgress(progress),
      ) ?? (() => undefined)
    );
  }

  private onProgress(progress: InstallProgress) {
    if (progress.status !== 'unknown') this.downloadRevision += 1;
    this.transition({ type: 'progress', ...progress });
  }

  /**
   * Em fila, não descartado: um pedido nunca engole o seguinte (a imediata
   * pedida pelo aviso remoto depois de uma flexível). A fila só espera as
   * consultas à loja, nunca a resposta de um fluxo: reabrir o app pelo ícone
   * (singleTask) fecha a tela da loja, e a Play pode nunca responder a ele.
   * Com a tela da loja por cima, o DeliveryProvider não pede checks.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.checks.then(task);
    this.checks = next.catch(() => undefined);
    return next;
  }

  /**
   * Depois da navegação pronta e a cada volta ao primeiro plano. Com
   * `required` (versão abaixo da mínima) pede a imediata uma vez por sessão e
   * retoma a interrompida; senão, a flexível segundo a política, no máximo a
   * cada dois dias.
   */
  check({ required }: { required: boolean }): Promise<void> {
    return this.enqueue(() => this.run(required));
  }

  private async run(required: boolean) {
    const { updates, store, now } = this.dependencies;
    const update = await updates?.check().catch(() => null);
    if (!updates || !update) return;
    this.publish({
      ...this.snapshot,
      storeUpToDate: isUpToDate(update),
      storeVersion: update.version ?? null,
    });
    // a App Store não instala daqui: nada de fluxo, o Início oferece a loja
    if (!updates.inApp) {
      await this.refreshOffer(update);
      return;
    }
    if (update.installStatus === 'downloaded') {
      this.onProgress({
        status: 'downloaded',
        bytesDownloaded: 1,
        totalBytes: 1,
      });
      return;
    }
    const type = chooseUpdate(update, { required });
    if (type === 'immediate') {
      // `inProgress`: o aluno saiu no meio do download da imediata; volta a
      // cada retorno ao app, e não só no primeiro pedido da sessão
      if (!this.immediateAsked || update.availability === 'inProgress')
        void this.openImmediate();
    } else if (type === 'flexible' && !this.flexibleAsked) {
      this.flexibleAsked = true;
      const last = await store
        .read<number>(FLEXIBLE_PROMPT_KEY)
        .catch(() => null);
      if (typeof last === 'number' && now() - last < FLEXIBLE_PROMPT_INTERVAL)
        return;
      await store.write(FLEXIBLE_PROMPT_KEY, now()).catch(() => undefined);
      const revision = this.downloadRevision;
      void this.start('flexible').then(result => {
        if (result === 'accepted' && revision === this.downloadRevision)
          this.transition({ type: 'accepted' });
      });
    }
  }

  /**
   * A oferta do Início, onde a loja não instala dentro do app: a versão nova
   * só depois de alguns dias na loja (o iPhone costuma se atualizar sozinho
   * antes disso), e nunca a que o aluno já dispensou.
   */
  private async refreshOffer(update: AppUpdate) {
    const aged = (update.stalenessDays ?? 0) >= FLEXIBLE_AFTER_DAYS;
    let offer =
      update.availability === 'available' && aged
        ? (update.version ?? null)
        : null;
    if (offer) {
      const dismissed = await this.dependencies.store
        .read<string>(OFFER_DISMISSED_KEY)
        .catch(() => null);
      if (dismissed === offer) offer = null;
    }
    this.publish({ ...this.snapshot, offer });
  }

  /** "Agora não" na oferta do Início: a mesma versão não volta. */
  async dismissOffer(): Promise<void> {
    const { offer } = this.snapshot;
    if (!offer) return;
    this.publish({ ...this.snapshot, offer: null });
    await this.dependencies.store
      .write(OFFER_DISMISSED_KEY, offer)
      .catch(() => undefined);
  }

  /** "Atualizar" na oferta do Início: a página do app na loja. */
  async openStore(): Promise<void> {
    await this.dependencies.storeListing.open();
  }

  private async start(
    type: 'flexible' | 'immediate',
  ): Promise<UpdateFlowResult> {
    const { updates } = this.dependencies;
    if (!updates) return 'notAllowed';
    return updates.start(type).catch((): UpdateFlowResult => 'failed');
  }

  /** Abre a imediata (sem segurar a fila, ver `enqueue`). */
  private openImmediate(): Promise<UpdateFlowResult> {
    this.immediateAsked = true;
    this.lastImmediate = this.start('immediate');
    return this.lastImmediate;
  }

  /** Instala a flexível baixada (a loja reinicia o app); `false` se falhou. */
  private async install(): Promise<boolean> {
    const { updates } = this.dependencies;
    if (!updates) return false;
    return updates.complete().then(
      () => true,
      () => false,
    );
  }

  /**
   * "Atualizar" da tela de versão sem suporte: instala a baixada, abre a
   * imediata da loja ou, se não der, a página do app na loja. Passa pela fila
   * como o check e vale como o pedido da sessão: o check automático não abre
   * outra imediata por cima. Onde a loja não instala dentro do app (a App
   * Store), vai direto à página dela.
   */
  async updateNow(): Promise<void> {
    const { updates, storeListing } = this.dependencies;
    this.immediateAsked = true;
    const before = this.lastImmediate;
    const step = await this.enqueue(async (): Promise<UpdateNowStep> => {
      if (updates && !updates.inApp) return { kind: 'storeListing' };
      const update = await updates?.check().catch(() => null);
      if (!update) return { kind: 'storeListing' };
      this.publish({ ...this.snapshot, storeUpToDate: isUpToDate(update) });
      if (update.installStatus === 'downloaded') return { kind: 'install' };
      // um check que já estava na fila pode ter aberto a imediata depois do toque
      const opened = this.lastImmediate;
      if (opened && opened !== before) return { kind: 'flow', result: opened };
      return chooseUpdate(update, { required: true })
        ? { kind: 'flow', result: this.openImmediate() }
        : { kind: 'storeListing' };
    });
    if (step.kind === 'install' && (await this.install())) return;
    if (step.kind === 'flow') {
      const result = await step.result;
      // cancelar a tela da loja é escolha do aluno: continua no bloqueio
      if (result === 'accepted' || result === 'canceled') return;
    }
    if (storeListing.available)
      await storeListing.open().catch(() => undefined);
  }

  /**
   * "Reiniciar": instala a flexível baixada. Se a loja não conseguir (pouco
   * espaço, download que sumiu), devolve `false`, e o aviso do Início só fica
   * se a atualização ainda estiver baixada.
   */
  async restart(): Promise<boolean> {
    if (await this.install()) return true;
    const update = await this.dependencies.updates?.check().catch(() => null);
    if (update?.installStatus !== 'downloaded') {
      this.downloadRevision += 1;
      this.transition({ type: 'reset' });
    }
    return false;
  }
}
