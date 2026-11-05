import type {
  CommunitySummary,
  NoticeAction,
  NoticeAnswer,
  NoticeList,
  NoticeRequest,
  NoticeResult,
  YouSummary,
} from '../domain/campusNow';
import type { RoomClass } from '../domain/nearby';
import {
  CAMPUS_STATE_KEY,
  normalizeCampusState,
  type CampusState,
} from './campusState';
import type {
  CampusNowServerPort,
  CampusNowStorePort,
  RequestOptions,
} from './ports';

export type CampusNowSnapshot = {
  /** A conta das escolhas lidas (`null`: ainda não lidas). */
  scope: string | null;
  /** "Não vou passar por lá": os avisos que não perguntam de novo hoje. */
  skipped: readonly string[];
  /** O aluno já abriu a tela (o celular só pergunta depois disso). */
  visited: boolean;
  /** Os avisos de que o celular já perguntou hoje, do mais antigo ao mais novo. */
  asked: readonly string[];
};

type Dependencies = {
  /** `null` sem a sessão de aluno (iPhone, app fora da Play): nada funciona. */
  server: CampusNowServerPort | null;
  store: CampusNowStorePort;
  account: () => { scope: string } | null | undefined;
  now: () => number;
};

const EMPTY: CampusNowSnapshot = {
  scope: null,
  skipped: [],
  visited: false,
  asked: [],
};

const sameClasses = (a: readonly RoomClass[], b: readonly RoomClass[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Agora no campus no app: os avisos do servidor (com a sessão de aluno) e o
 * que fica no aparelho, por conta: o que o aluno dispensou hoje, se ele já
 * abriu a tela, as salas da grade e os avisos dele de hoje (o que a
 * verificação sem tela usa para avisar no celular).
 */
export class CampusNow {
  private snapshot: CampusNowSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  /** Os avisos já contados em "viram" nesta execução, por conta. */
  private seenIds = new Map<string, Set<string>>();
  /** As gravações da preferência, uma de cada vez. */
  private writing: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: Dependencies) {}

  get supported(): boolean {
    return this.dependencies.server !== null;
  }

  getSnapshot = (): CampusNowSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private get server(): CampusNowServerPort {
    const { server } = this.dependencies;
    if (!server) throw new Error('Agora no campus indisponível');
    return server;
  }

  list(options?: RequestOptions): Promise<NoticeList> {
    return this.server.list(options);
  }

  async report(request: NoticeRequest): Promise<NoticeResult> {
    const result = await this.server.report(request);
    // o aviso novo é do aluno: a verificação sem tela conta o que acontecer com ele
    if (!result.merged && result.notice.mine)
      await this.update(state => {
        if (state.own.some(item => item.id === result.notice.id)) return state;
        return {
          ...state,
          own: [
            ...state.own,
            {
              id: result.notice.id,
              kind: result.notice.kind,
              status: result.notice.status,
              createdAt: result.notice.createdAt,
              thanks: 0,
              views: 0,
              confirmedTold: result.notice.confirmed,
              done: false,
            },
          ],
        };
      }).catch(() => undefined);
    return result;
  }

  answer(id: string, answer: NoticeAnswer): Promise<NoticeAction> {
    return this.server.answer(id, answer);
  }

  thank(id: string): Promise<NoticeAction> {
    return this.server.thank(id);
  }

  flag(id: string): Promise<void> {
    return this.server.flag(id);
  }

  you(options?: RequestOptions): Promise<YouSummary> {
    return this.server.you(options);
  }

  community(
    month: string,
    options?: RequestOptions,
  ): Promise<CommunitySummary> {
    return this.server.community(month, options);
  }

  /**
   * Os avisos que apareceram na tela contam em "quantos viram", uma vez por
   * execução (o servidor também conta uma vez por aluno). Uma falha devolve
   * os ids para a próxima vez.
   */
  async markSeen(ids: readonly string[]): Promise<void> {
    const owner = this.dependencies.account();
    if (!owner || !this.supported) return;
    const sent = this.seenIds.get(owner.scope) ?? new Set<string>();
    this.seenIds.set(owner.scope, sent);
    const fresh = [...new Set(ids)].filter(id => !sent.has(id));
    if (!fresh.length) return;
    fresh.forEach(id => sent.add(id));
    try {
      await this.server.seen(fresh);
    } catch {
      fresh.forEach(id => sent.delete(id));
    }
  }

  /** Lê as escolhas da conta ativa (ao abrir a tela ou o Início). */
  async load(): Promise<void> {
    const owner = this.dependencies.account();
    if (!owner) return;
    const state = await this.read(owner.scope);
    this.publish(owner.scope, state);
  }

  /** "Não vou passar por lá": o aviso não pergunta de novo hoje. */
  async skip(id: string): Promise<void> {
    await this.update(state =>
      state.skipped.includes(id)
        ? state
        : { ...state, skipped: [...state.skipped, id] },
    );
  }

  /** A primeira visita à tela liga os avisos do celular (se o aluno os quiser). */
  async visit(): Promise<void> {
    // a da conta ativa, lida do aparelho (a da memória pode ser de outra conta)
    await this.update(state =>
      state.visited ? state : { ...state, visited: true },
    );
  }

  /**
   * A lista chegou com o app na tela: o que o aluno já viu aqui (o aviso dele
   * confirmado, o nível novo) não vira aviso do celular depois. `true` quando
   * um aviso dele ganhou "Valeu" desde a última vez (um momento bom).
   */
  async observe(current: NoticeList): Promise<boolean> {
    let thanked = false;
    await this.update(state => {
      let changed = state.level !== current.you.level;
      const own = state.own.map(item => {
        const live = current.notices.find(notice => notice.id === item.id);
        if (!live) return item;
        const confirmedTold = item.confirmedTold || live.confirmed;
        const thanks = live.thanks ?? item.thanks;
        const views = live.views ?? item.views;
        if (thanks > item.thanks) thanked = true;
        if (
          confirmedTold === item.confirmedTold &&
          thanks === item.thanks &&
          views === item.views
        )
          return item;
        changed = true;
        return { ...item, confirmedTold, thanks, views };
      });
      return changed ? { ...state, own, level: current.you.level } : state;
    });
    return thanked;
  }

  /** As salas da grade, para a verificação sem tela; grava só quando mudam. */
  async rememberClasses(classes: readonly RoomClass[]): Promise<void> {
    await this.update(state =>
      sameClasses(state.classes, classes)
        ? state
        : { ...state, classes: [...classes] },
    );
  }

  private async read(scope: string): Promise<CampusState> {
    const raw = await this.dependencies.store
      .read<unknown>(scope, CAMPUS_STATE_KEY)
      .catch(() => null);
    return normalizeCampusState(raw, this.dependencies.now());
  }

  /** Lê, muda e grava a preferência da conta ativa, uma vez por vez. */
  private update(change: (state: CampusState) => CampusState): Promise<void> {
    const task = this.writing.then(async () => {
      const owner = this.dependencies.account();
      if (!owner) return;
      const before = await this.read(owner.scope);
      const after = change(before);
      if (after !== before)
        await this.dependencies.store.write(
          owner.scope,
          CAMPUS_STATE_KEY,
          after,
        );
      this.publish(owner.scope, after);
    });
    this.writing = task.catch(() => undefined);
    return task;
  }

  private publish(scope: string, state: CampusState) {
    const next: CampusNowSnapshot = {
      scope,
      skipped: state.skipped,
      visited: state.visited,
      asked: state.asked,
    };
    if (
      this.snapshot.scope === next.scope &&
      this.snapshot.visited === next.visited &&
      JSON.stringify(this.snapshot.skipped) === JSON.stringify(next.skipped) &&
      JSON.stringify(this.snapshot.asked) === JSON.stringify(next.asked)
    )
      return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }
}
