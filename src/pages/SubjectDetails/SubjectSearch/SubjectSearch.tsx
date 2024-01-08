import React, {useState, useRef} from 'react';
import {ListRenderItemInfo} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';

import {useAppSelector} from '@root/store';

import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/SubjectClassesSchedule/reducer';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container, InlineRow} from './SubjectSearch.styles';

type Props = {
  searchSubject: (s: string | number) => void;
};

const SubjectSearch = ({searchSubject}: Props) => {
  const [subjectCode, setSubjectCode] = useState('');

  const {data} = useAppSelector(reducer.selectSubjectClassesSearch);

  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);

  const ref = useRef<FlatList>(null);

  const handleSearch = async () => {
    try {
      searchSubject(subjectCode);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Parece que esse código não é válido :(',
        text2: 'Certifique-se de que escreveu o código corretamente.',
      });
    }
  };

  const renderSubjects = ({
    item,
  }: ListRenderItemInfo<(typeof data)[number]>) => {
    const {subject} = item;

    if (!subject) {
      return null;
    }

    return (
      <SubjectBox
        topLeftInfo={subject.id}
        name={subject.name!}
        onPress={() => searchSubject(subject.id as string)}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
      />
    );
  };

  const isEmpty = data.length === 0;

  return (
    <Container>
      <InlineRow>
        <TextInput
          value={subjectCode}
          onChangeText={setSubjectCode}
          onSubmitEditing={handleSearch}
          placeholder="Exemplo: IME02-01388 ou 01388"
          icon={<FontAwesome name="search" size={15} />}
        />
        <Button
          width={48}
          height={48}
          onPress={handleSearch}
          disabled={!subjectCode}>
          <FontAwesome name="send" size={22} />
        </Button>
      </InlineRow>
      <Text
        weight="bold"
        marginLeft="6px"
        marginTop="6px"
        marginBottom="6px"
        size="LG">
        Histórico
      </Text>
      {isBlocked && (
        <SmallDummyMessage
          type="BLOCK"
          text="O Aluno Online está temporariamente bloqueado."
          onPress={fetch}
        />
      )}
      {isEmpty && (
        <DummyMessage
          type="EMPTY"
          text="Parece que você não pesquisou nenhuma disciplina ainda, use a caixa acima para realizar a suas buscas."
        />
      )}
      <FlatList
        ref={ref}
        data={data}
        renderItem={renderSubjects}
        showsVerticalScrollIndicator={false}
        keyExtractor={(_, index) => index.toString()}
      />
    </Container>
  );
};

export default SubjectSearch;
