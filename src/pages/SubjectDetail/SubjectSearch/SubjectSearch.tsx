import React, {useState, useRef} from 'react';
import {ListRenderItemInfo} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import {useAppSelector} from '@root/store';
import * as reducer from '@root/reducers/subjectClassesSearch';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';

import {Container, InlineRow} from './SubjectSearch.styles';

type Props = {
  searchSubject: (s: string | number) => void;
};

const SubjectSearch = ({searchSubject}: Props) => {
  const [subjectCode, setSubjectCode] = useState('');
  const [loading, setLoading] = useState(false);

  const {data} = useAppSelector(reducer.selectSubjectClassesSearch);

  const ref = useRef<FlatList>(null);

  const handleSearch = async () => {
    setLoading(true);
    await searchSubject(subjectCode);
    setLoading(false);
  };

  const renderSubjects = ({item}: ListRenderItemInfo<typeof data[number]>) => {
    const {subject} = item;

    if (!subject) {
      return null;
    }

    return (
      <SubjectBox
        topLeftInfo={subject.id}
        name={subject.name}
        onPress={() => searchSubject(subject.id as string)}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
      />
    );
  };

  const isEmpty = data.length === 0;

  const reverseData = [...data].reverse();

  return (
    <Container>
      <InlineRow>
        <TextInput
          editable={!loading}
          value={subjectCode}
          onChangeText={setSubjectCode}
          onSubmitEditing={handleSearch}
          placeholder="Exemplo: IME02-01388 ou 01388"
          icon={<FontAwesome name="search" size={15} />}
        />
        <Button width={48} height={48} loading={loading} onPress={handleSearch}>
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
      <FlatList
        ref={ref}
        data={reverseData}
        renderItem={renderSubjects}
        showsVerticalScrollIndicator={false}
        keyExtractor={(_, index) => index.toString()}
      />
    </Container>
  );
};

export default SubjectSearch;
