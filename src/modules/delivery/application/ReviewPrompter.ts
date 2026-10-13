import {
  canRequestReview,
  parseReviewHistory,
  recordSession,
  type ReviewHistory,
} from '../domain/reviewPolicy';
import type { AppKeyValueStore, ReviewPromptPort } from './ports';

export const REVIEW_HISTORY_KEY = 'review-history';

type Dependencies = {
  review: ReviewPromptPort;
  store: AppKeyValueStore;
  now: () => number;
};

/**
 * Avaliação na loja depois de um momento positivo (grade compartilhada,
 * grades geradas), nunca por botão: só depois de alguns dias e sessões com a
 * conta carregada, no máximo uma vez a cada 120 dias e uma vez por sessão.
 */
export class ReviewPrompter {
  private sessionNoted = false;
  private askedThisSession = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: Dependencies) {}

  /** Leitura e escrita do histórico em fila: sessão e momento não se atropelam. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation, operation);
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async read(): Promise<ReviewHistory | null> {
    const raw = await this.dependencies.store
      .read<unknown>(REVIEW_HISTORY_KEY)
      .catch(() => null);
    return parseReviewHistory(raw);
  }

  private write(history: ReviewHistory) {
    return this.dependencies.store
      .write(REVIEW_HISTORY_KEY, history)
      .catch(() => undefined);
  }

  /** Conta a sessão (uma vez por abertura do app) quando a conta carrega. */
  noteSession(): Promise<void> {
    if (this.sessionNoted) return Promise.resolve();
    this.sessionNoted = true;
    return this.enqueue(async () => {
      await this.write(
        recordSession(await this.read(), this.dependencies.now()),
      );
    });
  }

  /** Pede a avaliação se a política deixar; `true` quando pediu. */
  notePositiveMoment(): Promise<boolean> {
    return this.enqueue(async () => {
      const { review, now } = this.dependencies;
      if (this.askedThisSession || !review.isAvailable()) return false;
      const history = await this.read();
      if (!history || !canRequestReview(history, now())) return false;
      this.askedThisSession = true;
      // a loja não diz se mostrou a folha: o pedido conta mesmo assim
      await this.write({ ...history, lastRequestAt: now() });
      await review.request().catch(() => undefined);
      return true;
    });
  }
}
