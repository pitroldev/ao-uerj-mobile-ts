import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useMutation } from '@tanstack/react-query';

import LoginPage from '../Login';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
}));
jest.mock('@features/Login/core', () => ({ handleLogin: jest.fn() }));
jest.mock('@atoms/Text', () => 'Text');
jest.mock('@atoms/TextInput', () => 'TextInput');
jest.mock('../Login.styles', () => ({
  LogoContainer: 'LogoContainer',
  LogoUERJ: 'LogoUERJ',
  Container: 'Container',
  SignInButton: 'SignInButton',
  RecoveryPassButton: 'RecoveryPassButton',
}));

type LoginCallbacks = {
  onSuccess: (data: { fail_reason: string }) => void;
  onError: (error: Error) => void;
};

describe('LoginPage feedback', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let callbacks: LoginCallbacks;

  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      renderer = TestRenderer.create(<LoginPage />);
    });
    callbacks = jest.mocked(useMutation).mock.calls[0][0] as LoginCallbacks;
  });

  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  function visibleError() {
    return renderer.root.findByProps({ color: 'ERROR' }).props.children;
  }

  it('does not display a failure for a successful login with an empty fail_reason', async () => {
    await act(async () => callbacks.onSuccess({ fail_reason: '' }));

    expect(visibleError()).toBe('');
  });

  it('displays the server rejection reason', async () => {
    await act(async () =>
      callbacks.onSuccess({ fail_reason: 'Matrícula ou senha inválida.' }),
    );

    expect(visibleError()).toBe('Matrícula ou senha inválida.');
  });

  it('displays a retry message when login throws without exposing request details', async () => {
    await act(async () =>
      callbacks.onError(new Error('LOGIN_REQ_ID_NOT_FOUND')),
    );

    expect(visibleError()).toBe(
      'Não foi possível acessar o Aluno Online. Verifique sua conexão e tente novamente.',
    );
  });
});
