import React, {useState, useEffect} from 'react';
import {FlatList, ListRenderItemInfo} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';

import {useBackHandler} from '@hooks/useBackHandler';
import useApiFetch from '@hooks/useApiFetch';

import {Docente} from '@features/TeacherDetails/types';
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

const TeacherSearch = () => {
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [teacherData, setTeacherData] = useState<Docente | null>(null);

  const {data, loading, error} = useApiFetch<string[]>(fetchTeacherList, {
    initialData: [],
  });

  useBackHandler(() => {
    if (selectedTeacher) {
      setSearch('');
      setSelectedTeacher('');
      setTeacherData(null);
      return true;
    }
    return false;
  });

  const handleRenderItem = ({item}: ListRenderItemInfo<string>) => (
    <SubjectBox name={item} onPress={() => setSelectedTeacher(item)} />
  );

  const fetchTeacher = async () => {
    try {
      setLoadingTeacher(true);
      const teacher = await fetchTeacherDetails(selectedTeacher);
      setTeacherData(teacher);
    } catch (err) {
      setTeacherData(null);
      setSelectedTeacher('');
      Toast.show({
        type: 'error',
        text1: 'Ops, ocorreu um erro ao buscar este professor.',
        text2: 'Tente novamente mais tarde.',
      });
    } finally {
      setLoadingTeacher(false);
    }
  };

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacher();
    }
  }, [selectedTeacher]);

  const filteredData = data.filter(name => name.match(new RegExp(search, 'i')));
  const isEmpty = filteredData.length === 0;

  if (selectedTeacher) {
    return (
      <Container>
        {loadingTeacher && <Spinner loading size="large" />}
        {teacherData && <TeacherView {...teacherData} />}
      </Container>
    );
  }

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
