import React, { useState, useRef } from 'react';
import {
  Keyboard,
  Linking,
  StyleSheet,
  type TextInputInstance,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';

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
import * as RootNavigation from '@services/rootNavigation';

import {
  Footer,
  Panel,
  RecoveryButton,
  Root,
  Subtitle,
  Top,
} from './Login.styles';

const PASS_RECOVERY_URL = 'https://www.alunoonline.uerj.br/requisicaoaluno/';
/** Linha de erro do formulário com até duas linhas (6 + 36 + 12). */
const ERROR_LINE_HEIGHT = 54;

export const LoginPage = () => {
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const { identity } = useAppServices();
  const { error: identityError } = useIdentity();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  // espaço entre o campo focado e o teclado: com a matrícula focada, cabem a
  // linha da senha, a linha de erro e o botão Entrar, com folga
  const keyboardClearance =
    theme.sizes.fieldGroupRow + ERROR_LINE_HEIGHT + theme.sizes.touch + 16;

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
      <KeyboardAwareScrollView
        bottomOffset={keyboardClearance}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Top $inset={insets.top}>
          <AoLogo width={164} />
          <Button
            label="Explorar o mapa"
            icon="location_on"
            variant="text"
            color={theme.colors.onBrand}
            onPress={() => {
              Keyboard.dismiss();
              RootNavigation.navigate('Mapa');
            }}
          />
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
              placeholder="Matrícula"
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
              placeholder="Senha"
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
      </KeyboardAwareScrollView>
    </Root>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
});
