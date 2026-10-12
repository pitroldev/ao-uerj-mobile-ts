import React, { Component, ReactNode } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import { ErrorState } from '@components/ui/Feedback';
import { Text } from '@components/ui/Text';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

const TOP_EDGE = ['top'] as const;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    this.setState({
      error,
      errorInfo: errorInfo.componentStack || undefined,
    });
  }

  handleResetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fica fora dos provedores do app: traz o próprio tema. A faixa da barra
      // de status é azul, como no resto do app, para os ícones claros
      // continuarem visíveis (no Android 15+ e no iOS o conteúdo passa por
      // baixo da barra).
      return (
        <ThemeProvider theme={LIGHT}>
          <SafeAreaView edges={TOP_EDGE} style={styles.root}>
            <StatusBar
              barStyle="light-content"
              backgroundColor={LIGHT.colors.brand}
            />
            <View style={styles.page}>
              <ErrorState
                title="Oops! Algo deu errado"
                message="Ocorreu um erro inesperado. Tente novamente ou reinicie o aplicativo."
                onRetry={this.handleResetError}
              />
              {__DEV__ && this.state.error ? (
                <Text variant="caption" weight="regular" tone="bad" selectable>
                  {this.state.error.message}
                </Text>
              ) : null}
            </View>
          </SafeAreaView>
        </ThemeProvider>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT.colors.brand },
  page: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: LIGHT.layout.gutter,
    backgroundColor: LIGHT.colors.surface,
  },
});

export default ErrorBoundary;
