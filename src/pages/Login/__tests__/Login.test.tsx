import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useMutation } from '@tanstack/react-query';

import LoginPage from '../Login';
import { AppError } from '@root/shared/errors/AppError';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ identity: { signIn: jest.fn() } }),
  useIdentity: () => ({ error: null }),
}));
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

  it('starts without an error', () => {
    expect(visibleError()).toBe('');
  });

  it('displays the server rejection reason', async () => {
    await act(async () => callbacks.onError(new AppError('LOGIN_FAILED')));

    expect(visibleError()).toBe(
      'Matrícula ou senha inválida. Confira seus dados.',
    );
  });

  it('displays a retry message when login throws without exposing request details', async () => {
    await act(async () =>
      callbacks.onError(new Error('LOGIN_REQ_ID_NOT_FOUND')),
    );

    expect(visibleError()).toBe('Não foi possível concluir. Tente novamente.');
  });

  it('validates missing credentials before making a request', async () => {
    const button = renderer.root.findByType(
      'SignInButton' as React.ElementType,
    );
    await act(async () => button.props.onPress());
    expect(visibleError()).toBe('Preencha a matrícula e a senha.');
    expect(
      jest.mocked(useMutation).mock.results[0].value.mutate,
    ).not.toHaveBeenCalled();
  });
});
