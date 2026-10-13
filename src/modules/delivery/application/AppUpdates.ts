import {
  chooseUpdate,
  FLEXIBLE_PROMPT_INTERVAL,
  type AppUpdate,
} from '../domain/updatePolicy';
import type {
  AppKeyValueStore,
  AppUpdatesPort,
  InstallProgress,
  StoreListingPort,
  UpdateFlowResult,
} from './ports';

export const FLEXIBLE_PROMPT_KEY = 'flexible-update-prompted-at';

export type UpdateSnapshot = {
  /** `downloaded`: a flexível terminou de baixar e espera o reinício. */
  phase: 'idle' | 'downloading' | 'downloaded';
  /** De 0 a 1 durante o download, quando a loja informa o tamanho. */
  progress: number | null;
  /**
   * A loja respondeu que não há versão mais nova para este aparelho (rollout
   * parcial, versão ainda não promovida para produção, aparelho fora dos
   * requisitos dela). `false` enquanto ela não responde e onde não há
   * atualização dentro do app.
   */
  storeUpToDate: boolean;
};

type Dependencies = {
  /** `null` onde não há atualização pela loja dentro do app. */
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

const IDLE: Pick<UpdateSnapshot, 'phase' | 'progress'> = {
  phase: 'idle',
  progress: null,
};

const isUpToDate = (update: AppUpdate) =>
  update.availability === 'none' && update.installStatus !== 'downloaded';

/**
 * Atualizações pela loja. A checagem nunca lança: fora da Play (debug,
 * emulador) ou no iOS ela simplesmente não encontra nada.
 */
export class AppUpdates {
  private snapshot: UpdateSnapshot = { ...IDLE, storeUpToDate: false };
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

  private publish(changes: Partial<UpdateSnapshot>) {
    const next = { ...this.snapshot, ...changes };
    const keys = Object.keys(next) as (keyof UpdateSnapshot)[];
    if (keys.every(key => next[key] === this.snapshot[key])) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  /** Acompanha o download da flexível; devolve a função que para. */
  listen(): () => void {
    return (
      this.dependencies.updates?.onInstallProgress(progress =>
        this.onProgress(progress),
      ) ?? (() => undefined)
    );
  }

  private onProgress({ status, bytesDownloaded, totalBytes }: InstallProgress) {
    if (status === 'downloaded') {
      this.publish({ phase: 'downloaded', progress: 1 });
    } else if (status === 'pending' || status === 'downloading') {
      this.publish({
        phase: 'downloading',
        progress: totalBytes > 0 ? bytesDownloaded / totalBytes : null,
      });
    } else if (status !== 'installing' && status !== 'unknown') {
      this.publish(IDLE);
    }
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
    this.publish({ storeUpToDate: isUpToDate(update) });
    if (update.installStatus === 'downloaded') {
      this.publish({ phase: 'downloaded', progress: 1 });
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
      void this.start('flexible').then(result => {
        if (result === 'accepted')
          this.publish({ phase: 'downloading', progress: null });
      });
    }
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
   * outra imediata por cima.
   */
  async updateNow(): Promise<void> {
    const { updates, storeListing } = this.dependencies;
    this.immediateAsked = true;
    const before = this.lastImmediate;
    const step = await this.enqueue(async (): Promise<UpdateNowStep> => {
      const update = await updates?.check().catch(() => null);
      if (!update) return { kind: 'storeListing' };
      this.publish({ storeUpToDate: isUpToDate(update) });
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
    if (update?.installStatus !== 'downloaded') this.publish(IDLE);
    return false;
  }
}
