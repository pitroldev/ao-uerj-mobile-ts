import React from 'react';
import { BackHandler } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { headerStore } from '@templates/Header/headerStore';
import { MessageBoard } from '../MessageBoard';

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
jest.mock('@features/MessageBoard/SubjectList', () => ({
  SubjectList: 'SubjectList',
}));
jest.mock('@features/MessageBoard/SubjectChat', () => ({
  SubjectChat: 'SubjectChat',
}));
const { FocusContext } = jest.requireMock('@react-navigation/native');

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
const BACK_PRESS = { type: 'hardwareBackPress', timeStamp: 0 };

// a lista e a conversa simuladas viram elementos host: as props são o
// contrato da tela com elas
const mounted = (name: 'SubjectList' | 'SubjectChat') =>
  screen.container.queryAll(node => node.type === name);

describe('message board hardware back', () => {
  let subscription: jest.SpyInstance;
  const handlers = new Set<BackPressHandler>();
  const pressBack = () =>
    [...handlers].reverse().some(handler => handler(BACK_PRESS));
  const board = (focused: boolean) => (
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
    await render(board(true));
  });
  // A limpeza automática da Testing Library roda depois deste afterEach: o
  // unmount explícito é o que permite conferir a liberação do voltar e da seta.
  afterEach(async () => {
    await screen.unmount();
    expect(handlers.size).toBe(0);
    expect(headerStore.getSnapshot().onBack).toBeNull();
    subscription.mockRestore();
  });
  const openChat = async () => {
    await act(() =>
      mounted('SubjectList')[0].props.onSubjectPress({
        id: 'QA00-99999',
        name: 'Disciplina de teste',
        class: '1',
      }),
    );
  };

  it('lets navigation handle back on the list and consumes it only to close a chat', async () => {
    let consumed: boolean | undefined;
    await act(() => {
      consumed = pressBack();
    });
    expect(consumed).toBe(false);
    expect(mounted('SubjectList')).toHaveLength(1);
    await openChat();
    expect(mounted('SubjectChat')).toHaveLength(1);
    await act(() => {
      consumed = pressBack();
    });
    expect(consumed).toBe(true);
    expect(mounted('SubjectList')).toHaveLength(1);
    await act(() => {
      consumed = pressBack();
    });
    expect(consumed).toBe(false);
  });

  it('does not intercept other routes while the mounted board is blurred', async () => {
    await openChat();
    await screen.rerender(board(false));
    expect(handlers.size).toBe(0);
    expect(pressBack()).toBe(false);
    expect(mounted('SubjectChat')).toHaveLength(1);
    await screen.rerender(board(true));
    expect(handlers.size).toBe(1);
    let consumed: boolean | undefined;
    await act(() => {
      consumed = pressBack();
    });
    expect(consumed).toBe(true);
    expect(mounted('SubjectList')).toHaveLength(1);
  });

  it('shows the header back arrow only while a chat is open and closes it from there', async () => {
    expect(headerStore.getSnapshot().onBack).toBeNull();
    await openChat();
    const onBack = headerStore.getSnapshot().onBack;
    expect(onBack).toEqual(expect.any(Function));
    await act(() => onBack?.());
    expect(mounted('SubjectList')).toHaveLength(1);
    expect(headerStore.getSnapshot().onBack).toBeNull();
  });
});
