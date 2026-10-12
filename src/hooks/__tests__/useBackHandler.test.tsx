import React from 'react';
import { BackHandler } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
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

function Listener({
  callback,
  goBack,
}: {
  callback: () => void;
  goBack?: boolean;
}) {
  useBackHandler(callback, goBack);
  return null;
}

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
const BACK_PRESS = { type: 'hardwareBackPress', timeStamp: 0 };

describe('focused hardware back handling', () => {
  let renderer: ReactTestRenderer;
  let subscription: jest.SpyInstance;
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
  afterEach(async () => {
    await act(async () => renderer.unmount());
    expect(handlers.size).toBe(0);
    subscription.mockRestore();
  });

  it('subscribes only while focused and releases the handler on blur and unmount', async () => {
    const callback = jest.fn();
    const screen = (focused: boolean) => (
      <FocusContext.Provider value={focused}>
        <Listener callback={callback} />
      </FocusContext.Provider>
    );
    await act(async () => {
      renderer = create(screen(false));
    });
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    await act(async () => renderer.update(screen(true)));
    expect(handlers.size).toBe(1);
    expect(pressBack()).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    await act(async () => renderer.update(screen(false)));
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    await act(async () => renderer.update(screen(true)));
    expect(handlers.size).toBe(1);
  });

  it('uses the current callback and current consumption flag without duplicate listeners', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const screen = (callback: () => void, goBack: boolean) => (
      <FocusContext.Provider value={true}>
        <Listener callback={callback} goBack={goBack} />
      </FocusContext.Provider>
    );
    await act(async () => {
      renderer = create(screen(first, true));
    });
    expect(pressBack()).toBe(true);
    await act(async () => renderer.update(screen(second, true)));
    expect(pressBack()).toBe(true);
    await act(async () => renderer.update(screen(second, false)));
    expect(handlers.size).toBe(1);
    expect(pressBack()).toBe(false);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
