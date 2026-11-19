import { AppError } from '@root/shared/errors/AppError';
import {
  IDEA_FIELDS,
  IdeaError,
  draftProblems,
  isContact,
  newIdea,
  similarText,
  type IdeaDraft,
  type IdeaPlatform,
  type MyIdea,
  type MyIdeas,
  type SimilarIdea,
} from '../domain/ideas';
import type { IdeasServerPort, IdeasStorePort, RequestOptions } from './ports';

/** A preferência da conta (o logout apaga). */
export const IDEAS_STATE_KEY = 'ideas';

/** As feitas já vistas que o aparelho guarda, no máximo. */
const SEEN_LIMIT = 200;

/** O que o aparelho guarda das sugestões, por conta. */
type IdeasState = {
  /**
   * O aluno já mandou ou somou alguma: só então o Sobre pergunta ao
   * servidor pelas feitas (quem nunca sugeriu não passa pela Play à toa).
   */
  known: boolean;
  /** As feitas que o aluno já viu como feitas (o destaque sai). */
  seenDone: string[];
};

export type IdeasSnapshot = {
  /** A conta das escolhas lidas (`null`: ainda não lidas). */
  scope: string | null;
  known: boolean;
  seenDone: readonly string[];
};

type Dependencies = {
  /** `null` sem a sessão de aluno (simulador, app fora da loja): nada funciona. */
  server: IdeasServerPort | null;
  store: IdeasStorePort;
  account: () => { scope: string } | null | undefined;
  /** A versão do app e o sistema, que vão no issue. */
  app: { version: string; platform: IdeaPlatform };
};

const EMPTY_STATE: IdeasState = { known: false, seenDone: [] };
const EMPTY: IdeasSnapshot = { scope: null, known: false, seenDone: [] };

function normalizeState(raw: unknown): IdeasState {
  if (!raw || typeof raw !== 'object') return EMPTY_STATE;
  const data = raw as Record<string, unknown>;
  const seenDone = Array.isArray(data.seenDone)
    ? data.seenDone.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : [];
  return {
    known: data.known === true,
    seenDone: [...new Set(seenDone)].slice(-SEEN_LIMIT),
  };
}

/**
 * "Sugerir uma ideia" no app: o servidor (com a sessão de aluno) e o que
 * fica no aparelho, por conta: se o aluno já sugeriu e quais feitas ele já
 * viu. O texto é conferido aqui antes de sair, nas regras do servidor.
 */
export class Ideas {
  private snapshot: IdeasSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  /** As gravações da preferência, uma de cada vez. */
  private writing: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: Dependencies) {}

  get supported(): boolean {
    return this.dependencies.server !== null;
  }

  getSnapshot = (): IdeasSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private get server(): IdeasServerPort {
    const { server } = this.dependencies;
    if (!server) throw new Error('Sugestões indisponíveis');
    return server;
  }

  async mine(options?: RequestOptions): Promise<MyIdeas> {
    const list = await this.server.mine(options);
    // depois de reinstalar, a lista é quem diz que o aluno já sugeriu
    if (list.ideas.length) await this.remember().catch(() => undefined);
    return list;
  }

  /** As parecidas com o título e o problema do rascunho. */
  similar(draft: IdeaDraft, options?: RequestOptions): Promise<SimilarIdea[]> {
    return this.server.similar(similarText(draft), options);
  }

  /**
   * Manda a ideia. `seenSimilar`: as parecidas que o aluno viu e disse que
   * a dele é outra. O contato num campo nem sai do aparelho.
   */
  async submit(
    draft: IdeaDraft,
    seenSimilar: readonly number[] = [],
  ): Promise<MyIdea> {
    const request = newIdea(draft, seenSimilar, this.dependencies.app);
    if (!request) {
      const problems = draftProblems(draft);
      const field = IDEA_FIELDS.find(name => isContact(problems[name]));
      throw field
        ? new IdeaError('contact', field)
        : new AppError('INVALID_INPUT');
    }
    const idea = await this.server.submit(request);
    await this.remember().catch(() => undefined);
    return idea;
  }

  /** "É essa": soma o pedido do aluno a um issue parecido. */
  async vote(issue: number): Promise<MyIdea> {
    const idea = await this.server.vote(issue);
    await this.remember().catch(() => undefined);
    return idea;
  }

  /** Lê as escolhas da conta ativa (ao abrir o Sobre ou a lista). */
  async load(): Promise<void> {
    const owner = this.dependencies.account();
    if (!owner) return;
    const state = await this.read(owner.scope);
    this.publish(owner.scope, state);
  }

  /** As feitas que apareceram na lista: o destaque não volta. */
  async markSeen(ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    await this.update(state => {
      const fresh = ids.filter(id => !state.seenDone.includes(id));
      return fresh.length
        ? {
            ...state,
            seenDone: [...state.seenDone, ...fresh].slice(-SEEN_LIMIT),
          }
        : state;
    });
  }

  private remember(): Promise<void> {
    return this.update(state =>
      state.known ? state : { ...state, known: true },
    );
  }

  private async read(scope: string): Promise<IdeasState> {
    const raw = await this.dependencies.store
      .read<unknown>(scope, IDEAS_STATE_KEY)
      .catch(() => null);
    return normalizeState(raw);
  }

  /** Lê, muda e grava a preferência da conta ativa, uma vez por vez. */
  private update(change: (state: IdeasState) => IdeasState): Promise<void> {
    const task = this.writing.then(async () => {
      const owner = this.dependencies.account();
      if (!owner) return;
      const before = await this.read(owner.scope);
      const after = change(before);
      if (after !== before)
        await this.dependencies.store.write(
          owner.scope,
          IDEAS_STATE_KEY,
          after,
        );
      this.publish(owner.scope, after);
    });
    this.writing = task.catch(() => undefined);
    return task;
  }

  private publish(scope: string, state: IdeasState) {
    if (
      this.snapshot.scope === scope &&
      this.snapshot.known === state.known &&
      JSON.stringify(this.snapshot.seenDone) === JSON.stringify(state.seenDone)
    )
      return;
    this.snapshot = { scope, known: state.known, seenDone: state.seenDone };
    this.listeners.forEach(listener => listener());
  }
}
