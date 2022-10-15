import React, {useEffect} from 'react';
import {Linking} from 'react-native';

import {useAppDispatch} from '@root/store';
import * as reducer from '@root/features/SubjectClassesSchedule/reducer';
import {useBackHandler} from '@root/hooks/useBackHandler';

import {SubjectClassesSchedule} from '@root/features/SubjectClassesSchedule/types';
import {SubjectData} from '@root/features/SubjectClassesSchedule/reducer';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import {ScrollView} from '@templates/CustomDrawerNavigator/CustomDrawerNavigator.styles';
import {Container, TransparentButton, InfoBox} from './SubjectView.styles';

import renderClassBox from './renderClassBox';

type Props = {
  searchSubject: (s: string | number) => Promise<void>;
  code: number;
  loading: boolean;
  classes?: SubjectClassesSchedule[];
  subject?: SubjectData['subject'];
  error?: unknown;
};

const SubjectView = ({
  searchSubject,
  code,
  classes,
  subject,
  error,
  loading,
}: Props) => {
  const dispatch = useAppDispatch();

  useBackHandler(() => dispatch(reducer.clearSelected()));

  const hasData = Boolean(classes && subject && code);
  const getSubject = async (subjectCode: string | number) => {
    const sameCode = code === subjectCode || subjectCode === subject?.id;
    if (hasData && sameCode) {
      return;
    }
    await searchSubject(subjectCode);
  };

  useEffect(() => {
    getSubject(code);
  }, [code]);

  const handleSyllabusPress = () => {
    const url = `https://www.ementario.uerj.br/ementa.php?cdg_disciplina=${code}`;
    Linking.openURL(url).catch((err: Error) => console.log('err', err));
  };

  const hasSubject = Boolean(subject);
  const hasClasses = classes && classes?.length > 0;
  const hasPrerequisite =
    subject?.prerequisite && subject.prerequisite.length > 0;

  return (
    <Container>
      <Text size="MD" italic weight="300" marginLeft="4px">
        {subject?.id ?? `Buscando disciplina ${code}`}
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {hasSubject && (
          <>
            <Text size="XL" weight="bold" marginLeft="4px">
              {subject?.name}
            </Text>
            <Text size="MD" weight="600" marginLeft="4px" marginTop="12px">
              Informações
            </Text>
            <InfoBox>
              <Text size="XS" weight="bold">
                {subject?.credits} Créditos
              </Text>
              <Text size="XS" weight="bold">
                {subject?.workload} Horas
              </Text>
              <Text size="XS" weight="bold">
                {subject?.duration}
              </Text>
            </InfoBox>
            <Text size="MD" weight="600" marginLeft="4px" marginTop="4px">
              Requisitos Exigidos
            </Text>
            {subject?.prerequisite?.map((reqs, index) => {
              return reqs.map(req => {
                return (
                  <SubjectBox
                    key={req.id}
                    topLeftInfo={req.id}
                    topRightInfo={index + 1}
                    name={req.name}
                    onPress={() => getSubject(req.id)}
                    boldOptions={{
                      topLeft: true,
                      topRight: true,
                      name: true,
                    }}
                  />
                );
              });
            })}
            {!hasPrerequisite && (
              <Text
                size="MD"
                color="BACKGROUND_400"
                alignSelf="center"
                weight="500"
                marginTop="12px"
                marginBottom="4px">
                Nenhum requisito exigido
              </Text>
            )}
          </>
        )}

        {classes && (
          <>
            <Text size="MD" weight="600" marginLeft="4px" marginTop="4px">
              Turmas
            </Text>
            {classes?.map(renderClassBox)}
            {!hasClasses && (
              <Text
                size="MD"
                color="BACKGROUND_400"
                alignSelf="center"
                weight="500"
                marginTop="12px"
                marginBottom="4px">
                Nenhuma turma disponível
              </Text>
            )}
          </>
        )}

        {loading && <Spinner size="large" />}

        {!loading && error && (
          <DummyMessage
            type="ERROR"
            text="Ops, ocorreu um erro ao buscar as informações da disciplina. Toque aqui para tentar novamente."
            onPress={() => getSubject(code)}
          />
        )}

        <TransparentButton onPress={handleSyllabusPress}>
          <Text
            size="MD"
            weight="600"
            alignSelf="center"
            marginTop="24px"
            marginBottom="24px">
            Acessar Ementa
          </Text>
        </TransparentButton>
      </ScrollView>
    </Container>
  );
};

export default SubjectView;
