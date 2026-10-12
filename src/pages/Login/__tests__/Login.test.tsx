import React from 'react';
import { Linking, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import { useMutation } from '@tanstack/react-query';

import { LIGHT } from '@root/themes';
import { Button, FieldGroup, FieldGroupRow } from '@components/ui';
import LoginPage from '../Login';
import { AppError } from '@root/shared/errors/AppError';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ identity: { signIn: jest.fn() } }),
  useIdentity: () => ({ error: null }),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
      renderer = TestRenderer.create(
        <ThemeProvider theme={LIGHT}>
          <LoginPage />
        </ThemeProvider>,
      );
    });
    callbacks = jest.mocked(useMutation).mock.calls[0][0] as LoginCallbacks;
  });

  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  /** Mensagem do formulário, mostrada abaixo do grupo de campos. */
  function visibleError() {
    return renderer.root.findByType(FieldGroup).props.error;
  }

  function texts() {
    return renderer.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .filter(child => typeof child === 'string');
  }

  function button(label: string) {
    return renderer.root
      .findAllByType(Button)
      .find(node => node.props.label === label)!;
  }

  function field(label: string) {
    return renderer.root
      .findAllByType(FieldGroupRow)
      .find(node => node.props.label === label)!;
  }

  it('starts without an error', () => {
    expect(visibleError()).toBe('');
    expect(texts()).not.toContain(
      'Matrícula ou senha inválida. Confira seus dados.',
    );
  });

  it('displays the server rejection reason', async () => {
    await act(async () => callbacks.onError(new AppError('LOGIN_FAILED')));

    expect(visibleError()).toBe(
      'Matrícula ou senha inválida. Confira seus dados.',
    );
    expect(texts()).toContain(
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
    await act(async () => button('Entrar').props.onPress());
    expect(visibleError()).toBe('Preencha a matrícula e a senha.');
    expect(
      jest.mocked(useMutation).mock.results[0].value.mutate,
    ).not.toHaveBeenCalled();
  });

  it('signs in with the typed credentials', async () => {
    await act(async () => field('Matrícula').props.onChangeText('2023100'));
    await act(async () => field('Senha').props.onChangeText('segredo'));
    await act(async () => button('Entrar').props.onPress());

    // cada render cria um `mutate`; vale o da renderização que recebeu o toque
    const signIns = jest
      .mocked(useMutation)
      .mock.results.reduce(
        (total, r) => total + r.value.mutate.mock.calls.length,
        0,
      );
    expect(signIns).toBe(1);
    expect(visibleError()).toBe('');
  });

  it('keeps the accessible labels of both fields', () => {
    expect(field('Matrícula').props.accessibilityLabel).toBe('Matrícula');
    expect(field('Senha').props.accessibilityLabel).toBe('Senha');
    expect(field('Senha').props.secureToggle).toBe(true);
  });

  it('opens the official portal to recover the password', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    await act(async () =>
      button('Não possui acesso ou esqueceu a senha?').props.onPress(),
    );
    expect(open).toHaveBeenCalledWith(
      'https://www.alunoonline.uerj.br/requisicaoaluno/',
    );
  });
});
