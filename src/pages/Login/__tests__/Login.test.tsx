import React from 'react';
import { Linking } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';
import { useMutation } from '@tanstack/react-query';

import { renderWithProviders } from '@root/test-utils/render';
import { LoginPage } from '../Login';
import { AppError } from '@root/shared/errors/AppError';

const mockSignIn = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@services/rootNavigation', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ identity: { signIn: mockSignIn } }),
  useIdentity: () => ({ error: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type LoginCallbacks = {
  mutationFn: () => Promise<void>;
  onError: (error: Error) => void;
};

describe('LoginPage feedback', () => {
  let callbacks: LoginCallbacks;

  beforeEach(async () => {
    jest.clearAllMocks();
    await renderWithProviders(<LoginPage />);
    callbacks = jest.mocked(useMutation).mock.calls[0][0] as LoginCallbacks;
  });

  /**
   * Opções do render cujo `mutate` recebeu o toque: a `mutationFn` dele leva a
   * matrícula e a senha digitadas até ali.
   */
  function pressedSignIn() {
    const { calls, results } = jest.mocked(useMutation).mock;
    const index = results.findIndex(r => r.value.mutate.mock.calls.length > 0);
    return calls[index][0] as LoginCallbacks;
  }

  /** Mensagem do formulário, anunciada abaixo do grupo de campos. */
  function formError() {
    return screen.queryByRole('alert');
  }

  /** Cada render cria um `mutate`; soma os toques que chegaram a algum deles. */
  function signIns() {
    return jest
      .mocked(useMutation)
      .mock.results.reduce(
        (total, r) => total + r.value.mutate.mock.calls.length,
        0,
      );
  }

  it('starts without an error', () => {
    expect(formError()).not.toBeOnTheScreen();
    expect(
      screen.queryByText('Matrícula ou senha inválida. Confira seus dados.'),
    ).not.toBeOnTheScreen();
  });

  it('opens the public map without credentials or signing in', async () => {
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Explorar o mapa' }));
    expect(mockNavigate).toHaveBeenCalledWith('Mapa');
    expect(signIns()).toBe(0);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(formError()).not.toBeOnTheScreen();
  });

  it('displays the server rejection reason', async () => {
    await act(() => callbacks.onError(new AppError('LOGIN_FAILED')));

    expect(formError()).toHaveAccessibleName(
      'Matrícula ou senha inválida. Confira seus dados.',
    );
    expect(
      screen.getByText('Matrícula ou senha inválida. Confira seus dados.'),
    ).toBeOnTheScreen();
  });

  it('explains a registration the portal does not accept, which may be maintenance', async () => {
    await act(() => callbacks.onError(new AppError('ACCOUNT_UNAVAILABLE')));

    expect(formError()).toHaveAccessibleName(
      'Matrícula inexistente, sem acesso ao Aluno Online ou portal em manutenção. Confira a matrícula ou tente mais tarde.',
    );
  });

  it('displays a retry message when login throws without exposing request details', async () => {
    await act(() => callbacks.onError(new Error('LOGIN_REQ_ID_NOT_FOUND')));

    expect(formError()).toHaveAccessibleName(
      'Não foi possível concluir. Tente novamente.',
    );
    expect(screen.queryByText(/LOGIN_REQ_ID/)).not.toBeOnTheScreen();
  });

  it('validates missing credentials before making a request', async () => {
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Entrar' }));
    expect(formError()).toHaveAccessibleName('Preencha a matrícula e a senha.');
    expect(signIns()).toBe(0);
  });

  it.each([
    ['2023100', 'segredo', '2023100', 'segredo'],
    // só a matrícula perde os espaços; a senha vai como foi digitada
    [' 2023100  ', ' segredo ', '2023100', ' segredo '],
  ])(
    'signs in with the typed credentials (%j, %j)',
    async (typedMatricula, typedPassword, matricula, password) => {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Matrícula'), typedMatricula);
      await user.type(screen.getByLabelText('Senha'), typedPassword);
      await user.press(screen.getByRole('button', { name: 'Entrar' }));

      expect(signIns()).toBe(1);
      expect(formError()).not.toBeOnTheScreen();
      await pressedSignIn().mutationFn();
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith({ matricula, password });
    },
  );

  it('keeps the accessible labels of both fields', () => {
    expect(screen.getByLabelText('Matrícula')).toBeOnTheScreen();
    // a senha começa oculta e o campo oferece o botão para mostrá-la
    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', true);
    expect(
      screen.getByRole('button', { name: 'Mostrar senha' }),
    ).toBeOnTheScreen();
  });

  it('opens the official portal to recover the password', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await userEvent.setup().press(
      screen.getByRole('button', {
        name: 'Não possui acesso ou esqueceu a senha?',
      }),
    );
    expect(open).toHaveBeenCalledWith(
      'https://www.alunoonline.uerj.br/requisicaoaluno/',
    );
  });
});
