import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { PACE_CREDITS, type Pace } from '../domain/plan';

/** Chave do ritmo e dos adiamentos do plano nas preferências da conta. */
export const PLAN_PREFERENCES_KEY = 'graduation-plan';

/**
 * A partir de quando uma disciplina adiada pode entrar: o período ("2027.1")
 * ou, sem o período em curso conhecido, o índice no plano.
 */
export type Postponement = { period: string } | { index: number };

export type PlanPreferences = {
  pace: Pace;
  postponed: Readonly<Record<string, Postponement>>;
};

export const DEFAULT_PLAN_PREFERENCES: PlanPreferences = {
  pace: 'normal',
  postponed: {},
};

type Stored = PlanPreferences & { version: 1 };

const isPostponement = (value: unknown): value is Postponement => {
  const item = value as Record<string, unknown> | null;
  if (!item || typeof item !== 'object') return false;
  if (typeof item.period === 'string') return /^\d{4}\.[12]$/.test(item.period);
  return (
    typeof item.index === 'number' &&
    Number.isInteger(item.index) &&
    item.index >= 0
  );
};

/** As escolhas guardadas, sem confiar no formato. */
export function normalizePlanPreferences(raw: unknown): PlanPreferences {
  const stored = raw as Partial<Stored> | null;
  if (!stored || typeof stored !== 'object') return DEFAULT_PLAN_PREFERENCES;
  const pace =
    typeof stored.pace === 'string' && stored.pace in PACE_CREDITS
      ? stored.pace
      : DEFAULT_PLAN_PREFERENCES.pace;
  const postponed =
    stored.postponed && typeof stored.postponed === 'object'
      ? Object.fromEntries(
          Object.entries(stored.postponed).filter(([, value]) =>
            isPostponement(value),
          ),
        )
      : {};
  return { pace, postponed };
}

/** Ritmo e adiamentos do plano, por conta (saem com o logout). */
export class PlanPreferencesStore {
  constructor(private readonly store: PreferencesStore) {}

  async read(scope: string): Promise<PlanPreferences> {
    return normalizePlanPreferences(
      await this.store.read(scope, PLAN_PREFERENCES_KEY),
    );
  }

  /** Muda as escolhas numa vez só da fila: dois toques não se sobrescrevem. */
  async change(
    scope: string,
    change: (current: PlanPreferences) => PlanPreferences,
  ): Promise<PlanPreferences> {
    const next = await this.store.update<Stored>(
      scope,
      PLAN_PREFERENCES_KEY,
      current => ({ version: 1, ...change(normalizePlanPreferences(current)) }),
    );
    return normalizePlanPreferences(next);
  }
}
