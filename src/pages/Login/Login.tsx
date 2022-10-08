import React, {useState, useRef} from 'react';
import {Linking} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {handleLogin} from '@services/UerjApi';

import Text from '@atoms/Text';
import TextInput from '@atoms/TextInput';
import {
  LogoContainer,
  LogoUERJ,
  Container,
  SignInButton,
  RecoveryPassButton,
} from './Login.styles';

const PASS_RECOVERY_URL =
  'https://www.alunoonline.uerj.br/requisicaoaluno/requisicao.php?controle=Login&requisicao=LoginSolicitarSenha';

// TODO: Juntar parser+reducer+type+api na pasta features

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');

  const passwordInputRef = useRef<any>(null);
  const navigation = useNavigation();

  const handleSignInPress = async () => {
    try {
      setLoading(true);
      const {fail_reason} = await handleLogin(matricula, password);
      setError(fail_reason ?? '');
      navigation.navigate('Início');
    } catch (err) {
      setError('Erro desconecido: ' + (err as unknown as Error)?.message);
      setLoading(false);
    }
  };

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
          onSubmitEditing={handleSignInPress}
        />
        <SignInButton
          loading={loading}
          disabled={loading}
          onPress={handleSignInPress}>
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
