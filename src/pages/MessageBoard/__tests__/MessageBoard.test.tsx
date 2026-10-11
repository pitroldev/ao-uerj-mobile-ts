import React from 'react';
import { BackHandler } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import MessageBoard from '../MessageBoard';

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
jest.mock('@features/MessageBoard/SubjectList', () => 'SubjectList');
jest.mock('@features/MessageBoard/SubjectChat', () => 'SubjectChat');
jest.mock('@atoms/Text', () => 'Text');
jest.mock('../MessageBoard.styles', () => ({ MainContainer: 'MainContainer' }));
const { FocusContext } = jest.requireMock('@react-navigation/native');

describe('message board hardware back', () => {
  let renderer: ReactTestRenderer;
  let subscription: jest.SpyInstance;
  const handlers = new Set<() => boolean | null | undefined>();
  const pressBack = () => [...handlers].reverse().some(handler => handler());
  const screen = (focused: boolean) => (
    <FocusContext.Provider value={focused}>
      <MessageBoard />
    </FocusContext.Provider>
  );
  beforeEach(async () => {
    handlers.clear();
    subscription = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
    await act(async () => {
      renderer = create(screen(true));
    });
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
    expect(handlers.size).toBe(0);
    subscription.mockRestore();
  });
  const openChat = async () => {
    await act(async () =>
      renderer.root.findByType('SubjectList' as never).props.onSubjectPress({
        id: 'QA00-99999',
        name: 'Disciplina de teste',
        class: '1',
      }),
    );
  };

  it('lets navigation handle back on the list and consumes it only to close a chat', async () => {
    let consumed: boolean | undefined;
    await act(async () => {
      consumed = pressBack();
    });
    expect(consumed).toBe(false);
    expect(renderer.root.findAllByType('SubjectList' as never)).toHaveLength(1);
    await openChat();
    expect(renderer.root.findAllByType('SubjectChat' as never)).toHaveLength(1);
    await act(async () => {
      consumed = pressBack();
    });
    expect(consumed).toBe(true);
    expect(renderer.root.findAllByType('SubjectList' as never)).toHaveLength(1);
    await act(async () => {
      consumed = pressBack();
    });
    expect(consumed).toBe(false);
  });

  it('does not intercept other routes while the mounted board is blurred', async () => {
    await openChat();
    await act(async () => renderer.update(screen(false)));
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(renderer.root.findAllByType('SubjectChat' as never)).toHaveLength(1);
    await act(async () => renderer.update(screen(true)));
    expect(handlers.size).toBe(1);
    let consumed: boolean | undefined;
    await act(async () => {
      consumed = pressBack();
    });
    expect(consumed).toBe(true);
    expect(renderer.root.findAllByType('SubjectList' as never)).toHaveLength(1);
  });
});
