import React from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Teacher } from '@root/modules/community/domain/models';
import Text from '@atoms/Text';
import SubjectBox from '@molecules/SubjectBox';

const TeacherView = ({ name, updatedAt, subjects }: Teacher) => {
  const navigation = useNavigation();
  return (
    <>
      <Text weight="bold" size="XL">
        {name}
      </Text>
      <Text italic size="SM">
        Atualizado em: {new Date(updatedAt).toLocaleDateString('pt-BR')}
      </Text>
      <Text weight="bold" marginTop="12px" marginBottom="8px">
        Disciplinas ministradas
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {subjects.flatMap(subject =>
          subject.classes.map(item => (
            <SubjectBox
              key={`${subject.id}-${item.number}`}
              name={subject.name}
              topLeftInfo={subject.id}
              topRightInfo={`Turma ${item.number}`}
              bottomLeftInfo={item.location || undefined}
              onPress={() =>
                navigation.navigate('Pesquisa de Disciplinas', {
                  subjectId: subject.id,
                  sourceRoute: 'Pesquisa de Professores',
                })
              }
              boldOptions={{ name: true }}
            />
          )),
        )}
      </ScrollView>
    </>
  );
};

export default TeacherView;
