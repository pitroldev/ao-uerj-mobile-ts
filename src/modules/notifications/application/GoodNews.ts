import { normalizeCheckState } from '../domain/checkState';
import { CHECK_STATE_KEY } from './NotificationSettings';
import type { ActiveAccount, NotificationStore } from './ports';

/** A boa notícia que o aluno já viu no app (preferência da conta). */
export const GOOD_NEWS_SEEN_KEY = 'notifications-good-news';

/** Depois disso, a notícia ficou velha: não é mais o momento. */
const GOOD_NEWS_WINDOW = 3 * 24 * 60 * 60 * 1000;

type Dependencies = {
  store: NotificationStore;
  account: () => ActiveAccount | null | undefined;
  now: () => number;
};

/**
 * As boas notícias da verificação em segundo plano (vaga confirmada,
 * aprovação nas notas), para o app contar como momento bom quando o aluno o
 * abre. A verificação só marca a hora; o que o app já contou fica numa
 * preferência à parte, para as duas não gravarem a mesma chave ao mesmo tempo.
 */
export class GoodNews {
  constructor(private readonly dependencies: Dependencies) {}

  /** `true` uma vez por boa notícia, até 3 dias depois dela. */
  async take(): Promise<boolean> {
    const { store, account, now } = this.dependencies;
    const scope = account()?.scope;
    if (!scope) return false;
    const { goodNewsAt } = normalizeCheckState(
      await store.read<unknown>(scope, CHECK_STATE_KEY).catch(() => null),
    );
    if (goodNewsAt === null) return false;
    const seen = await store
      .read<unknown>(scope, GOOD_NEWS_SEEN_KEY)
      .catch(() => null);
    if (typeof seen === 'number' && seen >= goodNewsAt) return false;
    // a conta pode ter saído durante a leitura
    if (account()?.scope !== scope) return false;
    await store
      .write(scope, GOOD_NEWS_SEEN_KEY, goodNewsAt)
      .catch(() => undefined);
    // uma notícia "do futuro" (o relógio do aparelho mudou) não é recente
    const age = now() - goodNewsAt;
    return age >= 0 && age <= GOOD_NEWS_WINDOW;
  }
}
