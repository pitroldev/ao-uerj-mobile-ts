import 'react-native-gesture-handler';
import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from 'styled-components';
import Toast from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LIGHT } from '@root/themes';
import { navigationRef, isReadyRef } from '@services/rootNavigation';
import queryClient from '@services/query-client';

import store from './store';
import MainRoutes from './routes';
import Header from '@templates/Header/Header';

const persistor = persistStore(store);

const App = () => {
  const [navigationState, setNavigationState] = useState<any>(null);

  const navTheme = DefaultTheme;
  navTheme.colors.background = LIGHT.COLORS.PRIMARY;

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider theme={LIGHT}>
            <PersistGate loading={null} persistor={persistor}>
              <Header navigationState={navigationState} />
              <NavigationContainer
                theme={navTheme}
                ref={navigationRef}
                onReady={() => {
                  Object.assign(isReadyRef, { current: true });
                }}
                onStateChange={state => {
                  requestAnimationFrame(() => setNavigationState(state));
                }}
              >
                <MainRoutes />
              </NavigationContainer>
              <Toast position="bottom" autoHide visibilityTime={10000} />
            </PersistGate>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
