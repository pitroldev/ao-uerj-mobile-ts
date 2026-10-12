import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { Teacher } from '@root/modules/community/domain/models';
import { List, ListRow, Section, Text } from '@components/ui';
import { Updated } from './TeacherView.styles';

/**
 * Detalhe do professor (conteúdo do painel): nome, data da atualização e as
 * turmas ministradas, cada uma levando ao detalhe da disciplina.
 */
const TeacherView = ({ name, updatedAt, subjects }: Teacher) => {
  const navigation = useNavigation();
  return (
    <>
      <Text variant="titleL" accessibilityRole="header">
        {name}
      </Text>
      <Updated variant="meta" tone="muted">
        Atualizado em: {new Date(updatedAt).toLocaleDateString('pt-BR')}
      </Updated>
      <Section title="Disciplinas ministradas">
        <List>
          {subjects.flatMap(subject =>
            subject.classes.map(item => (
              <ListRow
                key={`${subject.id}-${item.number}`}
                title={subject.name}
                code={subject.id}
                subtitle={`Turma ${item.number}`}
                meta={item.location || undefined}
                chevron
                onPress={() =>
                  navigation.navigate('Pesquisa de Disciplinas', {
                    subjectId: subject.id,
                    sourceRoute: 'Pesquisa de Professores',
                  })
                }
              />
            )),
          )}
        </List>
      </Section>
    </>
  );
};

export default TeacherView;
