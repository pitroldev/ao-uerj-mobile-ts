import React, { Component, ReactNode } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled, { ThemeProvider } from 'styled-components/native';

import { themes } from '@root/themes';
import { reportRenderError } from '@root/app/observability';
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

const Root = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.brand};
`;

const Page = styled.View`
  flex: 1;
  justify-content: center;
  padding: 0px ${({ theme }) => theme.layout.gutter}px;
  background-color: ${({ theme }) => theme.colors.background};
`;

/**
 * Fica fora dos provedores do app: traz o próprio tema, no esquema que o app
 * usa (a escolha do usuário chega ao `useColorScheme` pelo `Appearance`). O
 * topo é azul nos dois temas, então os ícones da barra de status são claros.
 */
function Fallback({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  const scheme = useColorScheme();
  return (
    <ThemeProvider theme={themes[scheme === 'dark' ? 'dark' : 'light']}>
      <Root edges={TOP_EDGE}>
        <StatusBar barStyle="light-content" />
        <Page>
          <ErrorState
            title="Oops! Algo deu errado"
            message="Ocorreu um erro inesperado. Tente novamente ou reinicie o aplicativo."
            onRetry={onRetry}
          />
          {__DEV__ && error ? (
            <Text variant="caption" weight="regular" tone="bad" selectable>
              {error.message}
            </Text>
          ) : null}
        </Page>
      </Root>
    </ThemeProvider>
  );
}

export class ErrorBoundary extends Component<Props, State> {
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
    reportRenderError(error, errorInfo.componentStack);
    // Um erro antes do onReady da navegação deixaria o splash nativo por cima.
    BootSplash.hide({ fade: true }).catch(() => undefined);

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

      return (
        <Fallback error={this.state.error} onRetry={this.handleResetError} />
      );
    }

    return this.props.children;
  }
}
