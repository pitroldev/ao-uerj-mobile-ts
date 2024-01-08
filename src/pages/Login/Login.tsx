import React, {useState, useRef} from 'react';
import {Linking} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {handleLogin} from '@features/Login/core';

import Text from '@atoms/Text';
import TextInput from '@atoms/TextInput';
import {
  LogoContainer,
  LogoUERJ,
  Container,
  SignInButton,
  RecoveryPassButton,
} from './Login.styles';
import {useMutation} from 'react-query';

const PASS_RECOVERY_URL = 'https://www.alunoonline.uerj.br/requisicaoaluno/';

const LoginPage = () => {
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');

  const passwordInputRef = useRef<any>(null);
  const navigation = useNavigation();

  const {isLoading: loading, mutate: handleSignInPress} = useMutation({
    mutationFn: () => handleLogin(matricula, password),
    onSuccess: data => {
      if (!data.fail_reason) {
        setError(data.fail_reason ?? '');
        return;
      }

      navigation.navigate('Início');
    },
  });

  const handleRecoveryPassPress = () => {
    Linking.openURL(PASS_RECOVERY_URL).catch((err: Error) =>
      console.log('handleRecoveryPassPress error', err),
    );
  };

  return (
    <LogoContainer>
      <LogoUERJ />
      <Container>
        <Text size="XXS" alignSelf="center" textAlign="center" color="ERROR">
          {error ?? ''}
        </Text>
        <Text weight="500" size="SM" marginLeft="5px">
          Matrícula
        </Text>
        <TextInput
          placeholder={'Digite sua matrícula'}
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
          secureTextEntry
          value={password}
          ref={passwordInputRef}
          onChangeText={setPassword}
          onSubmitEditing={() => handleSignInPress()}
        />
        <SignInButton
          loading={loading}
          disabled={loading}
          onPress={() => handleSignInPress()}>
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
