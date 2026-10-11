import React, { useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import { useQuery } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage, isTransientError } from '@root/shared/errors/AppError';
import { useBackHandler } from '@hooks/useBackHandler';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import TeacherView from '@features/TeacherDetails/TeacherView';
import Spinner from '@atoms/Spinner';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';
import { Container } from './TeacherSearch.styles';

const TeacherSearch = () => {
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const { community } = useAppServices();
  const { account } = useIdentity();
  useBackHandler(() => setSelectedTeacher(''), Boolean(selectedTeacher));
  const teachers = useQuery({
    queryKey: communityKeys.teachers(account?.scope ?? 'signed-out'),
    queryFn: ({ signal }) => community.teachers({ signal }),
    enabled: Boolean(account),
    staleTime: 24 * 60 * 60 * 1000,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const teacher = useQuery({
    queryKey: communityKeys.teacher(
      account?.scope ?? 'signed-out',
      selectedTeacher,
    ),
    queryFn: ({ signal }) => community.teacher(selectedTeacher, { signal }),
    enabled: Boolean(account && selectedTeacher),
    staleTime: 60 * 60 * 1000,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const normalizedSearch = search
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const filteredData = teachers.data?.filter(name =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(normalizedSearch),
  );
  if (selectedTeacher)
    return (
      <Container>
        {teacher.isLoading && <Spinner loading size="large" />}
        {!!teacher.error && (
          <DummyMessage
            type="ERROR"
            text={errorMessage(teacher.error)}
            onPress={() => {
              void teacher.refetch();
            }}
          />
        )}
        {teacher.data && <TeacherView {...teacher.data} />}
        {teacher.data === null && (
          <DummyMessage
            type="EMPTY"
            text="Nenhum detalhe encontrado para este professor. Volte para escolher outro nome."
            onPress={() => setSelectedTeacher('')}
          />
        )}
      </Container>
    );
  const renderItem = ({ item }: ListRenderItemInfo<string>) => (
    <SubjectBox name={item} onPress={() => setSelectedTeacher(item)} />
  );
  return (
    <Container>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Pesquise pelo nome do professor"
        icon={<FontAwesome name="search" size={15} />}
      />
      {teachers.isLoading && <Spinner loading size="large" />}
      {!teachers.isLoading && !teachers.error && filteredData?.length === 0 && (
        <SmallDummyMessage text="Nenhum professor encontrado" type="EMPTY" />
      )}
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyExtractor={item => item}
      />
      {!!teachers.error && (
        <DummyMessage
          text={errorMessage(teachers.error)}
          type="ERROR"
          onPress={() => {
            void teachers.refetch();
          }}
        />
      )}
    </Container>
  );
};

export default TeacherSearch;
