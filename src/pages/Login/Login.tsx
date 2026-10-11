import React, { useState, useRef } from 'react';
import { Linking, type TextInput as NativeTextInput } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';

import Text from '@atoms/Text';
import TextInput from '@atoms/TextInput';
import {
  LogoContainer,
  LogoUERJ,
  Container,
  SignInButton,
  RecoveryPassButton,
} from './Login.styles';

const PASS_RECOVERY_URL = 'https://www.alunoonline.uerj.br/requisicaoaluno/';

const LoginPage = () => {
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const { identity } = useAppServices();
  const { error: identityError } = useIdentity();

  const passwordInputRef = useRef<NativeTextInput>(null);

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
    <LogoContainer>
      <LogoUERJ />
      <Container>
        <Text weight="500" size="SM" marginLeft="5px">
          Matrícula
        </Text>
        <TextInput
          placeholder={'Digite sua matrícula'}
          accessibilityLabel="Matrícula"
          autoComplete="username"
          autoCapitalize="none"
          keyboardType="number-pad"
          value={matricula}
          onChangeText={setMatricula}
          onSubmitEditing={() => passwordInputRef?.current?.focus()}
        />
        <Text weight="500" size="SM" marginLeft="5px" marginTop="20px">
          Senha
        </Text>
        <TextInput
          placeholder={'Digite sua senha'}
          accessibilityLabel="Senha"
          autoComplete="password"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          ref={passwordInputRef}
          onChangeText={setPassword}
          onSubmitEditing={() => handleSignInPress()}
        />
        <Text size="XS" alignSelf="center" textAlign="center" color="ERROR">
          {error || identityError || ''}
        </Text>
        <SignInButton
          loading={loading}
          disabled={loading}
          onPress={() => handleSignInPress()}
        >
          Entrar
        </SignInButton>

        <RecoveryPassButton onPress={handleRecoveryPassPress}>
          <Text weight="bold" size="SM" alignSelf="center" textAlign="center">
            Não possui acesso ou esqueceu a senha?
          </Text>
        </RecoveryPassButton>
      </Container>
    </LogoContainer>
  );
};

export default LoginPage;
