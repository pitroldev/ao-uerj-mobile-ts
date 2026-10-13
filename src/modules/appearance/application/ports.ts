import type { ThemePreference } from '../domain/themePreference';

/** Armazenamento do app inteiro (não por conta): o tema sobrevive ao logout. */
export interface AppearanceStore {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}

/** Aparência nativa: alertas, seletores e barras do sistema acompanham a escolha. */
export interface NativeAppearance {
  apply(preference: ThemePreference): void;
}
