import React, { type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { ThemeProvider, type DefaultTheme } from 'styled-components/native';

import { themes, type ColorSchemeName } from '@root/themes';

export type ProvidersOptions = {
  /** `'light'` (padrão), `'dark'` ou um tema montado no teste. */
  theme?: DefaultTheme | ColorSchemeName;
  /** Sem cliente, a árvore fica sem `QueryClientProvider`. */
  queryClient?: QueryClient;
  /** Provedores do próprio teste (`FormProvider`, contextos), por dentro do tema. */
  wrapper?: ComponentType<{ children: ReactNode }>;
};

/**
 * Provedores que as telas esperam do app. Use como `wrapper` do `renderHook`
 * ou de um `render` que precise de opções próprias.
 */
export function createWrapper({
  theme = 'light',
  queryClient,
  wrapper: Inner,
}: ProvidersOptions = {}) {
  const resolved = typeof theme === 'string' ? themes[theme] : theme;
  return function Providers({ children }: { children: ReactNode }) {
    const themed = (
      <ThemeProvider theme={resolved}>
        {Inner ? <Inner>{children}</Inner> : children}
      </ThemeProvider>
    );
    return queryClient ? (
      <QueryClientProvider client={queryClient}>{themed}</QueryClientProvider>
    ) : (
      themed
    );
  };
}

/** `render` da Testing Library com o tema do app (e, se pedido, React Query). */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: ProvidersOptions,
) {
  return render(ui, { wrapper: createWrapper(options) });
}

/**
 * Cliente isolado por teste: sem novas tentativas e sem coleta por tempo, para
 * não deixar timers do React Query vivos depois do teste.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
}
