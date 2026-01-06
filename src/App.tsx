import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { Provider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from 'styled-components';
import Toast from 'react-native-toast-message';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LIGHT } from '@root/themes';
import {
  navigationRef,
  isReadyRef,
  resetNavigationReady,
} from '@services/rootNavigation';
import queryClient from '@services/query-client';
import ErrorBoundary from '@components/ErrorBoundary';

import store from './store';
import MainRoutes from './routes';
import Header from '@components/templates/Header/Header';

const persistor = persistStore(store);

enableScreens(true);

// Handle app state changes for React Query
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

const App = () => {
  const [navigationState, setNavigationState] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  const navTheme = DefaultTheme;
  navTheme.colors.background = LIGHT.COLORS.PRIMARY;

  const onNavigationReady = useCallback(() => {
    isReadyRef.current = true;
    setIsReady(true);
  }, []);

  const onNavigationStateChange = useCallback((state: any) => {
    requestAnimationFrame(() => setNavigationState(state));
  }, []);

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ThemeProvider theme={LIGHT}>
              <PersistGate loading={null} persistor={persistor}>
                {isReady && <Header navigationState={navigationState} />}
                <NavigationContainer
                  theme={navTheme}
                  ref={navigationRef}
                  onReady={onNavigationReady}
                  onStateChange={onNavigationStateChange}
                >
                  <MainRoutes />
                </NavigationContainer>
                <Toast position="bottom" autoHide visibilityTime={10000} />
              </PersistGate>
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
