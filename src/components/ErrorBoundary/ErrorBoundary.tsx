import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import Text from '@atoms/Text';
import Button from '@atoms/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

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

      return (
        <View style={styles.container}>
          <Text weight="bold" size="LG" alignSelf="center" marginBottom="16px">
            Oops! Algo deu errado
          </Text>
          <Text
            size="SM"
            alignSelf="center"
            textAlign="center"
            marginBottom="16px"
          >
            Ocorreu um erro inesperado. Tente novamente ou reinicie o
            aplicativo.
          </Text>
          {__DEV__ && this.state.error && (
            <Text size="XS" color="ERROR" marginBottom="16px">
              {this.state.error.message}
            </Text>
          )}
          <Button onPress={this.handleResetError} size="small">
            Tentar Novamente
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default ErrorBoundary;
