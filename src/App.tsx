import 'react-native-gesture-handler';
import React, { useState, useCallback } from 'react';
import { enableScreens } from 'react-native-screens';
import {
  DefaultTheme,
  NavigationContainer,
  type NavigationState,
} from '@react-navigation/native';
import { ThemeProvider } from 'styled-components/native';
import Toast from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LIGHT } from '@root/themes';
import { navigationRef } from '@services/rootNavigation';
import ErrorBoundary from '@components/ErrorBoundary';
import { createAppServices } from './app/composition/createAppServices';
import { AppServicesProvider } from './app/providers/AppServicesProvider';
import { loadDevLinking } from './app/dev';
import MainRoutes from './routes';
import Header from '@components/templates/Header/Header';
import { toastConfig } from '@components/ui/Snackbar';

const services = createAppServices();
const devLinking = loadDevLinking(services);
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: LIGHT.colors.brand },
};

enableScreens(true);

const App = () => {
  const [navigationState, setNavigationState] = useState<NavigationState>();
  const [isReady, setIsReady] = useState(false);

  const onNavigationReady = useCallback(() => {
    setNavigationState(navigationRef.current?.getRootState());
    setIsReady(true);
  }, []);

  const onNavigationStateChange = useCallback(
    (state: NavigationState | undefined) => {
      setNavigationState(state);
    },
    [],
  );

  return (
    <ErrorBoundary>
      <AppServicesProvider services={services}>
        <QueryClientProvider client={services.queryClient}>
          <SafeAreaProvider>
            <ThemeProvider theme={LIGHT}>
              {isReady && <Header navigationState={navigationState} />}
              <NavigationContainer
                theme={navTheme}
                linking={devLinking}
                ref={navigationRef}
                onReady={onNavigationReady}
                onStateChange={onNavigationStateChange}
              >
                <MainRoutes />
              </NavigationContainer>
              <Toast
                config={toastConfig}
                position="bottom"
                autoHide
                visibilityTime={10000}
              />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </AppServicesProvider>
    </ErrorBoundary>
  );
};

export default App;
