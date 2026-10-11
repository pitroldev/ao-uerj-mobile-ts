import {
  useCurriculum,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import React, { useState, useRef } from 'react';
import { ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { FlatList } from 'react-native-gesture-handler';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';

import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import { normalizeText } from '@utils/normalize';

import { CurriculumSubject } from '@root/modules/academics/domain/models';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import Text from '@atoms/Text';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import { Container, Row, View } from './CurriculumSubjects.styles';

const CurriculumSubjects = () => {
  const [subjectAlreadyTaken, setSubjectAlreadyTaken] = useState(false);
  const [subjectType, setSubjectType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const query = useCurriculum();
  const { data = [], isLoading: loading, error, refetch } = query;
  const isBlocked = isPortalBlocked(error);

  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const handleSubjectTypeChange = (value: string) => {
    setSubjectType(value);
    ref.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const handleSubjectPress = (subject: CurriculumSubject) => {
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: subject.id,
      sourceRoute: 'Disciplinas do Currículo',
    });
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<CurriculumSubject>) => {
    if (!subject) {
      return null;
    }

    const { name, id, type, credits, workload, branch, period, alreadyTaken } =
      subject;
    const creditText = credits ? `${credits} créditos` : '';
    const workloadText = workload !== null ? `${workload} horas` : '';

    const periodText = period ? `${period}º Período` : '';

    const ramificationText = branch
      ? `${periodText ? ' - ' : ''}Ramificação ${branch}`
      : '';

    const description = `${periodText}${ramificationText}`;

    return (
      <SubjectBox
        topLeftInfo={id}
        topRightInfo={SUBJECT_TYPE[type] || type}
        name={name}
        color={alreadyTaken ? 'GOOD' : undefined}
        description={description}
        bottomLeftInfo={creditText}
        bottomRightInfo={workloadText}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredData = data.filter(({ type, name, alreadyTaken }) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));
    const hasSubjectAlreadyTaken =
      subjectAlreadyTaken === Boolean(alreadyTaken);

    return hasSubjectType && hasSearchQuery && hasSubjectAlreadyTaken;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  if (isBlocked && !data.length) {
    return (
      <Container>
        <DummyMessage
          type="BLOCK"
          text="Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde."
          onPress={refetch}
        />
      </Container>
    );
  }

  return (
    <Container>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={error}
        hasData={query.data !== undefined}
        retry={refetch}
      />
      <Row>
        <View>
          <StyledPicker
            selectedValue={subjectType}
            onValueChange={s => handleSubjectTypeChange(s as string)}
            loading={loading}
            enabled={!loading}
          >
            <Picker.Item label={'Todas as Disciplinas'} value={''} />
            <Picker.Item
              label={'Disciplinas Obrigatórias'}
              value={'MANDATORY'}
            />
            <Picker.Item label={'Eletivas Restritas'} value={'RESTRICTED'} />
            <Picker.Item label={'Eletivas Definidas'} value={'DEFINED'} />
            <Picker.Item label={'Universais'} value={'UNIVERSAL'} />
          </StyledPicker>
        </View>
        <View>
          <StyledPicker
            selectedValue={subjectAlreadyTaken}
            onValueChange={s => setSubjectAlreadyTaken(s as boolean)}
            loading={loading}
            enabled={!loading}
          >
            <Picker.Item label={'Não Atendidas'} value={false} />
            <Picker.Item label={'Atendidas'} value={true} />
          </StyledPicker>
        </View>
      </Row>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Pesquise pelo nome da disciplina"
        icon={<FontAwesome name="search" size={15} />}
      />
      {!loading && !isBlocked && !error && (
        <Text size="SM" marginTop="8px" marginBottom="8px" marginLeft="5px">
          Exibindo {filteredData.length} disciplina
          {filteredData.length === 1 ? '' : 's'}
        </Text>
      )}
      {isBlocked && showList && (
        <SmallDummyMessage
          type="BLOCK"
          text="O Aluno Online está temporariamente bloqueado."
          onPress={refetch}
        />
      )}
      {showSpinner && <Spinner size={40} />}
      {!loading && !!error && !isBlocked && !data.length && (
        <DummyMessage
          type="ERROR"
          onPress={refetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {showList && (
        <FlatList
          ref={ref}
          data={filteredData}
          renderItem={renderSubjects}
          showsVerticalScrollIndicator={false}
          keyExtractor={(_, index) => index.toString()}
        />
      )}
    </Container>
  );
};

export default CurriculumSubjects;
