/** Escolha do usuário em "Tema": acompanhar o aparelho ou fixar um esquema. */
export type ThemePreference = 'system' | 'light' | 'dark';

export type ColorScheme = 'light' | 'dark';

/** Valor salvo (de qualquer versão) → escolha válida; o resto volta a seguir o sistema. */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * Esquema em uso. Em "sistema" vale o do aparelho; sem resposta dele
 * (plataforma sem o módulo de aparência), o claro.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
