import React from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useKeyboardInset } from '../SubjectChat/useKeyboardInset';

type Listener = (event: KeyboardEvent) => void;

let listeners: Record<string, Listener>;
let renderer: ReactTestRenderer;
let inset: number;
const originalOS = Platform.OS;
const versionDescriptor = Object.getOwnPropertyDescriptor(Platform, 'Version');

function Probe({ bottom }: { bottom: number }) {
  inset = useKeyboardInset(bottom);
  return null;
}

const setPlatform = (os: 'ios' | 'android', version: number) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', {
    get: () => version,
    configurable: true,
  });
};
const keyboard = (height: number): KeyboardEvent => ({
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { height, screenX: 0, screenY: 0, width: 412 },
});
const render = async (bottom: number) => {
  await act(async () => {
    renderer = create(<Probe bottom={bottom} />);
  });
};
const emit = async (name: string, event: KeyboardEvent) => {
  await act(async () => listeners[name]!(event));
};

beforeEach(() => {
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    name: string,
    listener: Listener,
  ) => {
    listeners[name] = listener;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', {
    value: originalOS,
    configurable: true,
  });
  if (versionDescriptor) {
    Object.defineProperty(Platform, 'Version', versionDescriptor);
  }
});

describe('useKeyboardInset', () => {
  it('lifts by the keyboard minus the safe area already reserved (iOS)', async () => {
    setPlatform('ios', 17);
    await render(34);
    expect(inset).toBe(0);
    await emit('keyboardWillShow', keyboard(336));
    expect(inset).toBe(302);
    await emit('keyboardWillHide', keyboard(0));
    expect(inset).toBe(0);
  });

  it('lifts by the reported height on Android edge-to-edge and clears on hide', async () => {
    setPlatform('android', 35);
    await render(24);
    // o Android já informa a altura sem a barra de navegação
    await emit('keyboardDidShow', keyboard(280));
    expect(inset).toBe(280);
    await emit('keyboardDidHide', keyboard(0));
    expect(inset).toBe(0);
  });

  it('does not lift twice when adjustResize already shrinks the window', async () => {
    setPlatform('android', 34);
    await render(0);
    await emit('keyboardDidShow', keyboard(280));
    expect(inset).toBe(0);
  });
});
