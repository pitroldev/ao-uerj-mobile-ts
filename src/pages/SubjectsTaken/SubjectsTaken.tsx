import React, { useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  useHistory,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';

import { SelectField } from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import {
  TakenSubjectsSummary,
  TakenSubjectsTable,
  buildPeriodOptions,
} from '@features/SubjectsTaken';
import {
  SubjectListFallback,
  subjectListPhase,
} from '@features/SubjectsToTake';

const NO_SUBJECTS: SubjectsTaken[] = [];

export const SubjectsTakenScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const query = useHistory();
  const { error, refetch } = query;
  const retry = () => {
    void refetch();
  };
  const data = query.data ?? NO_SUBJECTS;
  const periodOptions = useMemo(() => buildPeriodOptions(data), [data]);

  const navigation = useNavigation();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const activePeriod = periodOptions.some(
    option => option.value === selectedPeriod,
  )
    ? selectedPeriod
    : (periodOptions[0]?.value ?? '');

  const subjects = data.filter(({ period }) => period === activePeriod);
  const phase = subjectListPhase(query, {
    hasData: query.data !== undefined,
    blocked: isPortalBlocked(error),
  });

  const handleSelectedPeriodChange = (value: string) => {
    setSelectedPeriod(value);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubjectPress = (subject: SubjectsTaken) => {
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: subject.id,
      sourceRoute: 'Disciplinas Realizadas',
    });
  };

  return (
    <ScreenPanel scrollRef={scrollRef}>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={error}
        hasData={query.data !== undefined}
        retry={refetch}
      />
      <SelectField
        label="Período"
        icon="date_range"
        options={periodOptions}
        value={activePeriod}
        onChange={handleSelectedPeriodChange}
        placeholder={
          phase === 'loading' ? 'Carregando…' : 'Nenhum período disponível'
        }
        disabled={periodOptions.length === 0}
      />
      {subjects.length > 0 ? (
        <>
          <TakenSubjectsSummary subjects={subjects} />
          <TakenSubjectsTable
            period={activePeriod}
            subjects={subjects}
            onSubjectPress={handleSubjectPress}
          />
        </>
      ) : (
        <SubjectListFallback
          phase={phase}
          onRetry={retry}
          empty={{
            icon: 'history_edu',
            text: 'Parece que não há disciplinas cursadas no período selecionado.',
          }}
        />
      )}
    </ScreenPanel>
  );
};
