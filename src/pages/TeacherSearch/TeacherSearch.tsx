import React, {useState} from 'react';
import {FlatList, ListRenderItemInfo} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import {useQuery} from 'react-query';

import {useBackHandler} from '@hooks/useBackHandler';

import {
  fetchTeacherList,
  fetchTeacherDetails,
} from '@features/TeacherDetails/core';
import TeacherView from '@features/TeacherDetails/TeacherView';

import Spinner from '@atoms/Spinner';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container} from './TeacherSearch.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const TeacherSearch = () => {
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  useBackHandler(() => {
    setSearch('');
    setSelectedTeacher('');
  }, Boolean(selectedTeacher));

  const {
    data,
    isFetching: loading,
    error,
  } = useQuery({
    queryKey: ['teacher-list'],
    queryFn: fetchTeacherList,
    staleTime: 24 * HOUR_IN_MS,
    initialData: [],
  });

  const {data: teacherData, isFetching: loadingTeacher} = useQuery({
    queryKey: ['teacher-details', selectedTeacher],
    queryFn: () => fetchTeacherDetails(selectedTeacher),
    staleTime: 24 * HOUR_IN_MS,
    onError: () => {
      setSelectedTeacher('');
      Toast.show({
        type: 'error',
        text1: 'Ops, ocorreu um erro ao buscar este professor.',
        text2: 'Tente novamente mais tarde.',
      });
    },
  });

  const filteredData = data?.filter(name =>
    name.match(new RegExp(search, 'i')),
  );
  const isEmpty = filteredData?.length === 0;

  if (selectedTeacher) {
    return (
      <Container>
        {loadingTeacher && <Spinner loading size="large" />}
        {teacherData && <TeacherView {...teacherData} />}
      </Container>
    );
  }

  const handleRenderItem = ({item}: ListRenderItemInfo<string>) => (
    <SubjectBox name={item} onPress={() => setSelectedTeacher(item)} />
  );

  return (
    <Container>
      <TextInput
        onChangeText={setSearch}
        placeholder="Pesquise pelo nome do professor"
        icon={<FontAwesome name="search" size={15} />}
      />
      {loading && <Spinner loading size="large" />}
      {!loading && !error && isEmpty && (
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
    </Container>
  );
};

export default TeacherSearch;
