import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LIGHT } from '@root/themes';

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
          <Text style={styles.title} accessibilityRole="header">
            Oops! Algo deu errado
          </Text>
          <Text style={styles.description}>
            Ocorreu um erro inesperado. Tente novamente ou reinicie o
            aplicativo.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.error}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity
            onPress={this.handleResetError}
            accessibilityRole="button"
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>Tentar Novamente</Text>
          </TouchableOpacity>
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
    backgroundColor: LIGHT.COLORS.BACKGROUND,
  },
  title: {
    color: LIGHT.COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: LIGHT.COLORS.TEXT_PRIMARY,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  error: {
    color: LIGHT.COLORS.ERROR,
    fontSize: 12,
    marginBottom: 16,
  },
  button: {
    padding: 8,
    minHeight: 44,
    minWidth: 150,
    borderRadius: 5,
    backgroundColor: LIGHT.COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    color: LIGHT.COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
