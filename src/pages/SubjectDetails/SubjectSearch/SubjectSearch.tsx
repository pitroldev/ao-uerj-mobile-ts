import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { useIdentity } from '@root/app/providers/AppServicesProvider';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import { SubjectInfo } from '@root/modules/academics/domain/models';
import ScreenPanel from '@templates/ScreenPanel';
import {
  Button,
  EmptyState,
  List,
  ListRow,
  SearchField,
  Section,
} from '@components/ui';

import { creditsAndHours } from '../subjectFormat';
import { Grow, SearchRow } from './SubjectSearch.styles';

type Props = {
  searchSubject: (s: string | number) => void;
};

const EMPTY_TEXT =
  'Parece que você não pesquisou nenhuma disciplina ainda, use a caixa acima para realizar a suas buscas.';

const SubjectSearch = ({ searchSubject }: Props) => {
  const [subjectCode, setSubjectCode] = useState('');

  const queryClient = useQueryClient();
  const { account } = useIdentity();
  const data = account
    ? queryClient
        .getQueryCache()
        .findAll({
          queryKey: academicKeys.resource(
            account.scope,
            account.period,
            'subject-details',
          ),
        })
        .filter(query => query.state.data !== undefined)
        .sort(
          (left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt,
        )
        .slice(0, 20)
        .map(query => query.state.data as SubjectInfo)
        .filter(subject => Boolean(subject?.id))
    : [];

  const handleSearch = () => {
    try {
      searchSubject(subjectCode);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Parece que esse código não é válido :(',
        text2: 'Certifique-se de que escreveu o código corretamente.',
      });
    }
  };

  const isEmpty = data.length === 0;

  return (
    <ScreenPanel>
      <SearchRow>
        <Grow>
          <SearchField
            value={subjectCode}
            onChangeText={setSubjectCode}
            onSubmitEditing={handleSearch}
            placeholder="Exemplo: IME02-01388 ou 01388"
            accessibilityLabel="Código da disciplina"
            clearLabel="Limpar código"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </Grow>
        <Button
          icon="arrow_forward"
          accessibilityLabel="Buscar disciplina"
          onPress={handleSearch}
          disabled={!subjectCode}
        />
      </SearchRow>
      {isEmpty ? (
        <EmptyState icon="manage_search" text={EMPTY_TEXT} />
      ) : (
        <Section title="Pesquisas recentes">
          <List>
            {data.map(subject => (
              <ListRow
                key={subject.id}
                leadingIcon="history"
                title={subject.name || (subject.id as string)}
                code={subject.id}
                subtitle={creditsAndHours(subject.credits, subject.workload)}
                chevron
                onPress={() => searchSubject(subject.id as string)}
              />
            ))}
          </List>
        </Section>
      )}
    </ScreenPanel>
  );
};

export default SubjectSearch;
