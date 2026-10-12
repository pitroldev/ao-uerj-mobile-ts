import React from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootDrawerParamList } from '@root/routes';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import { useSubjectDetails } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import ScreenPanel from '@templates/ScreenPanel';
import SubjectSearch from './SubjectSearch';
import SubjectView from './SubjectView';

const SubjectDetailPage = () => {
  const route =
    useRoute<RouteProp<RootDrawerParamList, 'Pesquisa de Disciplinas'>>();
  const navigation = useNavigation();
  const subjectId = route.params?.subjectId;
  const query = useSubjectDetails(subjectId);
  const searchSubject = (input: string | number) => {
    const normalized = normalizeSubjectId(input);
    if (subjectId === normalized) void query.refetch();
    else
      navigation.navigate('Pesquisa de Disciplinas', {
        subjectId: normalized,
        sourceRoute: route.params?.sourceRoute,
      });
  };
  if (!subjectId) return <SubjectSearch searchSubject={searchSubject} />;
  return (
    // a chave volta a rolagem ao topo ao abrir outra disciplina (requisito)
    <ScreenPanel key={subjectId}>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={query.error}
        hasData={query.data !== undefined}
        retry={query.refetch}
      />
      <SubjectView
        searchSubject={searchSubject}
        subject={query.data}
        code={subjectId}
        loading={query.isLoading}
        error={query.error}
        sourceRoute={route.params?.sourceRoute}
      />
    </ScreenPanel>
  );
};

export default SubjectDetailPage;
