import React from 'react';
import { BackHandler } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useBackHandler } from '../useBackHandler';

// Model the navigation boundary: focus starts the effect, blur cleans it up.
jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  const FocusContext = ReactModule.createContext(false);
  return {
    FocusContext,
    useFocusEffect: (effect: () => void | (() => void)) => {
      const focused = ReactModule.useContext(FocusContext);
      ReactModule.useEffect(
        () => (focused ? effect() : undefined),
        [focused, effect],
      );
    },
  };
});

const { FocusContext } = jest.requireMock('@react-navigation/native');

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
type ListenerProps = { callback: () => void; goBack?: boolean };
const BACK_PRESS = { type: 'hardwareBackPress', timeStamp: 0 };

describe('focused hardware back handling', () => {
  let subscription: jest.SpyInstance;
  let unmount: () => Promise<void>;
  // Lido a cada render: mude o valor e chame `rerender` para focar/desfocar.
  let focused = false;
  function ScreenFocus({ children }: { children: React.ReactNode }) {
    return (
      <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>
    );
  }
  const renderListener = async (props: ListenerProps) => {
    const hook = await renderHook(
      ({ callback, goBack }: ListenerProps) => useBackHandler(callback, goBack),
      { initialProps: props, wrapper: ScreenFocus },
    );
    unmount = hook.unmount;
    return hook;
  };
  const handlers = new Set<BackPressHandler>();
  const pressBack = () =>
    [...handlers].reverse().some(handler => handler(BACK_PRESS));
  beforeEach(() => {
    handlers.clear();
    subscription = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
  });
  // A limpeza automática da Testing Library roda depois deste afterEach: o
  // unmount explícito é o que permite conferir a liberação do handler.
  afterEach(async () => {
    await unmount();
    expect(handlers.size).toBe(0);
    subscription.mockRestore();
  });

  it('subscribes only while focused and releases the handler on blur and unmount', async () => {
    const callback = jest.fn();
    focused = false;
    const { rerender } = await renderListener({ callback });
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    focused = true;
    await rerender({ callback });
    expect(handlers.size).toBe(1);
    expect(pressBack()).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    focused = false;
    await rerender({ callback });
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    focused = true;
    await rerender({ callback });
    expect(handlers.size).toBe(1);
  });

  it('uses the current callback and current consumption flag without duplicate listeners', async () => {
    const first = jest.fn();
    const second = jest.fn();
    focused = true;
    const { rerender } = await renderListener({
      callback: first,
      goBack: true,
    });
    expect(pressBack()).toBe(true);
    await rerender({ callback: second, goBack: true });
    expect(pressBack()).toBe(true);
    await rerender({ callback: second, goBack: false });
    expect(handlers.size).toBe(1);
    expect(pressBack()).toBe(false);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
