import React, { useState, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';
import {
  AoLogo,
  Button,
  FieldGroup,
  FieldGroupRow,
  Text,
} from '@components/ui';
import { version } from '@/package.json';

import {
  Footer,
  Panel,
  RecoveryButton,
  Root,
  Subtitle,
  Top,
} from './Login.styles';

const PASS_RECOVERY_URL = 'https://www.alunoonline.uerj.br/requisicaoaluno/';

const LoginPage = () => {
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const { identity } = useAppServices();
  const { error: identityError } = useIdentity();
  const insets = useSafeAreaInsets();

  const passwordInputRef = useRef<TextInputInstance>(null);

  const { isPending: loading, mutate: login } = useMutation({
    mutationFn: () =>
      identity.signIn({ matricula: matricula.trim(), password }),
    onError: failure => setError(errorMessage(failure)),
  });

  const handleSignInPress = () => {
    if (loading) return;
    if (!matricula.trim() || !password) {
      setError('Preencha a matrícula e a senha.');
      return;
    }
    setError('');
    login();
  };

  const handleRecoveryPassPress = () => {
    void Linking.openURL(PASS_RECOVERY_URL).catch(() =>
      setError('Não foi possível abrir o portal.'),
    );
  };

  return (
    <Root>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Top $inset={insets.top}>
            <AoLogo width={164} />
          </Top>
          <Panel $inset={insets.bottom}>
            <Text variant="titleL" accessibilityRole="header">
              Entre com sua conta
            </Text>
            <Subtitle tone="muted">
              Use a mesma matrícula e senha do Aluno Online.
            </Subtitle>
            <FieldGroup error={error || identityError || ''}>
              <FieldGroupRow
                icon="badge"
                label="Matrícula"
                placeholder="Digite sua matrícula"
                accessibilityLabel="Matrícula"
                autoComplete="username"
                autoCapitalize="none"
                keyboardType="number-pad"
                returnKeyType="next"
                submitBehavior="submit"
                clearable
                value={matricula}
                onChangeText={setMatricula}
                onSubmitEditing={() => passwordInputRef?.current?.focus()}
              />
              <FieldGroupRow
                ref={passwordInputRef}
                icon="lock"
                label="Senha"
                placeholder="Digite sua senha"
                accessibilityLabel="Senha"
                autoComplete="password"
                autoCapitalize="none"
                returnKeyType="go"
                secureToggle
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => handleSignInPress()}
              />
            </FieldGroup>
            <Button
              label="Entrar"
              block
              loading={loading}
              loadingLabel="Entrando…"
              onPress={() => handleSignInPress()}
            />
            <RecoveryButton
              variant="link"
              label="Não possui acesso ou esqueceu a senha?"
              onPress={handleRecoveryPassPress}
            />
            <Footer
              variant="caption"
              weight="regular"
              tone="muted"
              align="center"
            >
              {`Aplicativo não oficial e de código aberto · Versão ${version}`}
            </Footer>
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>
    </Root>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
});

export default LoginPage;
