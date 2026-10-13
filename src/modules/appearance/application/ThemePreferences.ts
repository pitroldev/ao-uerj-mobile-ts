import {
  parseThemePreference,
  type ThemePreference,
} from '../domain/themePreference';
import type { AppearanceStore, NativeAppearance } from './ports';

export const THEME_PREFERENCE_KEY = 'theme-preference';

type Dependencies = {
  store: AppearanceStore;
  native: NativeAppearance;
};

/**
 * Tema escolhido pelo usuário (Padrão do sistema, Claro ou Escuro). Até a
 * leitura da escolha salva, segue o sistema. A escolha vale na hora, vai para
 * a parte nativa e fica salva; falha ao salvar só perde a escolha na próxima
 * abertura.
 */
export class ThemePreferences {
  private preference: ThemePreference = 'system';
  private listeners = new Set<() => void>();
  private starting: Promise<void> | null = null;
  private chosen = false;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): ThemePreference => this.preference;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Na abertura: lê a escolha salva e a repassa à parte nativa. Idempotente. */
  start(): Promise<void> {
    this.starting ??= this.restore();
    return this.starting;
  }

  choose = async (preference: ThemePreference): Promise<void> => {
    this.chosen = true;
    if (preference !== this.preference) {
      this.dependencies.native.apply(preference);
      this.publish(preference);
    }
    await this.dependencies.store
      .write(THEME_PREFERENCE_KEY, preference)
      .catch(() => undefined);
  };

  private publish(preference: ThemePreference) {
    this.preference = preference;
    this.listeners.forEach(listener => listener());
  }

  private async restore() {
    const saved = await this.dependencies.store
      .read<unknown>(THEME_PREFERENCE_KEY)
      .catch(() => null);
    // uma escolha feita durante a leitura vale mais que a salva
    if (this.chosen) return;
    const preference = parseThemePreference(saved);
    // o nativo já começa seguindo o sistema
    if (preference === 'system') return;
    this.dependencies.native.apply(preference);
    this.publish(preference);
  }
}
