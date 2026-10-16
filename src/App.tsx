import 'react-native-gesture-handler';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { LogBox, View } from 'react-native';
import { enableScreens } from 'react-native-screens';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type NavigationState,
} from '@react-navigation/native';
import { ThemeProvider } from 'styled-components/native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { registerNavigationContainer } from '@services/rootNavigation';
import { resetSplash } from '@root/app/splash';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { createAppServices } from './app/composition/createAppServices';
import { AppServicesProvider } from './app/providers/AppServicesProvider';
import { recordScreen } from './app/observability';
import { loadDevLinking } from './app/dev';
import { DeliveryProvider } from './modules/delivery/presentation/DeliveryProvider';
import { useActiveTheme } from './modules/appearance/presentation/useActiveTheme';
import { navigationTheme } from './modules/appearance/presentation/navigationTheme';
import { MainRoutes, type RootDrawerParamList } from './routes';
import { Header } from '@components/templates/Header/Header';
import { SnackbarHost } from '@components/ui/Snackbar';

const services = createAppServices();
const devLinking = loadDevLinking();

enableScreens(true);

if (__DEV__) {
  // Avisos de debug que não indicam erro do app; continuam no console e só
  // saem do LogBox, cujo balão cobria o pé da tela (e os toques dos testes E2E):
  // - o react-native-keyboard-controller 1.22.7 passa dependências aos hooks
  //   do Reanimated 4.7;
  // - o Reanimated avisa quando o aparelho usa "reduzir movimento" (ou está
  //   com as animações desligadas).
  LogBox.ignoreLogs([
    '[Reanimated] Dependencies should only be used on the web',
    '[Reanimated] Reduced motion setting is enabled on this device',
  ]);
}

export const App = () => {
  const [navigationState, setNavigationState] = useState<NavigationState>();
  const [isReady, setIsReady] = useState(false);
  const theme = useActiveTheme(services.appearance);
  // Uma ref por raiz: recriar a atividade pode montar a raiz nova antes de
  // desmontar a antiga (ver registerNavigationContainer).
  const navigationRef =
    useRef<NavigationContainerRef<RootDrawerParamList>>(null);
  useLayoutEffect(() => registerNavigationContainer(navigationRef), []);
  // o splash nativo sai no primeiro layout de tela (ver routes.tsx)
  useLayoutEffect(resetSplash, []);

  const onNavigationReady = useCallback(() => {
    setNavigationState(navigationRef.current?.getRootState());
    setIsReady(true);
    recordScreen(navigationRef.current?.getCurrentRoute()?.name);
  }, []);

  const onNavigationStateChange = useCallback(
    (state: NavigationState | undefined) => {
      setNavigationState(state);
      recordScreen(navigationRef.current?.getCurrentRoute()?.name);
    },
    [],
  );

  return (
    <ErrorBoundary>
      <AppServicesProvider services={services}>
        <QueryClientProvider client={services.queryClient}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ThemeProvider theme={theme}>
              <KeyboardProvider>
                <View collapsable={false}>
                  {isReady && <Header navigationState={navigationState} />}
                </View>
                <NavigationContainer
                  theme={navigationTheme(theme)}
                  linking={devLinking}
                  ref={navigationRef}
                  onReady={onNavigationReady}
                  onStateChange={onNavigationStateChange}
                >
                  <DeliveryProvider
                    delivery={services.delivery}
                    ready={isReady}
                  >
                    <MainRoutes />
                  </DeliveryProvider>
                </NavigationContainer>
                <SnackbarHost />
              </KeyboardProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </AppServicesProvider>
    </ErrorBoundary>
  );
};
