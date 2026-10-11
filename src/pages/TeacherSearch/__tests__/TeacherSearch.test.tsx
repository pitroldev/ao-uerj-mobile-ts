import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useQuery } from '@tanstack/react-query';
import TeacherSearch from '../TeacherSearch';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ community: {} }),
  useIdentity: () => ({ account: { scope: 'test-account' } }),
}));
jest.mock('@hooks/useBackHandler', () => ({ useBackHandler: jest.fn() }));
jest.mock('@react-native-vector-icons/fontawesome', () => ({
  FontAwesome: 'Icon',
}));
jest.mock('react-native', () => ({ FlatList: 'FlatList' }));
jest.mock('@features/TeacherDetails/TeacherView', () => 'TeacherView');
jest.mock('@atoms/Spinner', () => 'Spinner');
jest.mock('@atoms/TextInput', () => 'TextInput');
jest.mock('@molecules/SubjectBox', () => 'SubjectBox');
jest.mock('@molecules/DummyMessage', () => 'DummyMessage');
jest.mock('@molecules/SmallDummyMessage', () => 'SmallDummyMessage');
jest.mock('../TeacherSearch.styles', () => ({ Container: 'Container' }));

describe('teacher search', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(async () => {
    jest.mocked(useQuery).mockImplementation((options: any) =>
      options.queryKey[2] === 'teachers'
        ? ({
            data: ['Álvaro Souza', 'Ana [Teste]'],
            isLoading: false,
            error: null,
          } as any)
        : ({
            data: undefined,
            isLoading: Boolean(options.enabled),
            error: null,
          } as any),
    );
    await act(async () => {
      renderer = TestRenderer.create(<TeacherSearch />);
    });
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  it('treats search text literally and matches names without accents', async () => {
    await act(async () =>
      renderer.root.findByType('TextInput' as never).props.onChangeText('['),
    );
    expect(renderer.root.findByType('FlatList' as never).props.data).toEqual([
      'Ana [Teste]',
    ]);
    await act(async () =>
      renderer.root
        .findByType('TextInput' as never)
        .props.onChangeText('alvaro'),
    );
    expect(renderer.root.findByType('FlatList' as never).props.data).toEqual([
      'Álvaro Souza',
    ]);
  });

  it('keeps the selected teacher while details are still loading', async () => {
    const item = renderer.root
      .findByType('FlatList' as never)
      .props.renderItem({ item: 'Álvaro Souza' });
    await act(async () => item.props.onPress());
    expect(renderer.root.findAllByType('Spinner' as never)).toHaveLength(1);
    expect(renderer.root.findAllByType('FlatList' as never)).toHaveLength(0);
  });
});
