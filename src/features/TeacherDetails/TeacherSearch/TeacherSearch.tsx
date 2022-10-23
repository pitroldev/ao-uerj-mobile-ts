import React, {useState} from 'react';
import {FlatList, ListRenderItemInfo} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import {useBackHandler} from '@hooks/useBackHandler';
import useApiFetch from '@hooks/useApiFetch';

import {fetchTeacherList} from '../core';

import Spinner from '@atoms/Spinner';
import TextInput from '@atoms/TextInput';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

const TeacherSearch = () => {
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  const {data, loading, error} = useApiFetch<string[]>(fetchTeacherList);

  useBackHandler(() => {
    if (selectedTeacher) {
      setSearch('');
      setSelectedTeacher(null);
      return true;
    }
    return false;
  });

  function handleRenderItem({item}: ListRenderItemInfo<string>) {
    return null;
  }

  const filteredData = data.filter(name => name.match(new RegExp(search, 'i')));
  const isEmpty = filteredData.length === 0;

  return (
    <>
      <TextInput
        onTextChange={setSearch}
        placeholder="Pesquise pelo nome do professor"
        icon={<FontAwesome name="search" size={15} />}
      />
      {loading && <Spinner loading />}
      {isEmpty && (
        <SmallDummyMessage text="Nenhum professor encontrado" type="EMPTY" />
      )}
      <FlatList
        data={filteredData}
        renderItem={handleRenderItem}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item, index) => `${item}${index}`}
      />
      {error && (
        <DummyMessage
          text="Houve um erro ao buscar a lista de professores"
          type="ERROR"
        />
      )}
    </>
  );
};

export default TeacherSearch;
