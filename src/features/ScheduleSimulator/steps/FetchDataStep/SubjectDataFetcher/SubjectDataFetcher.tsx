import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components';
import { TouchableOpacity } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import Icon from 'react-native-vector-icons/AntDesign';

import { parseSubjectCode } from '@services/parser/minorParser';

import { Prereq } from '@features/SubjectInfo/types';
import { getSubjectInfo } from '@features/SubjectInfo/core';

import { ScheduleCreationParams } from '@features/ScheduleSimulator/types';
import { CurriculumSubject } from '@features/CurriculumSubjects/types';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';

import { Container, Row } from './SubjectDataFetcher.styles';
import { parseScheduleToGeneratorFormat } from '@root/utils/converter';
import { hasScheduleConflict } from '@root/features/ScheduleSimulator/core';

const SubjectDataFetcher = (subject: CurriculumSubject) => {
  const { COLORS } = useTheme();
  const { control, setValue } = useFormContext<ScheduleCreationParams>();

  const {
    subjects,
    selectedClasses,
    takenSubjects,
    busy_schedules: busySchedules,
  } = useWatch({ control }) as ScheduleCreationParams;

  const code = parseSubjectCode(subject.id);
  const alreadyHasSubject = subjects?.some(s => s.id === subject.id) ?? false;

  const {
    isLoading: loadingInfo,
    error: errorInfo,
    refetch: refetchInfo,
    data: subjectInfo,
  } = useQuery({
    queryKey: ['subject-info', code],
    queryFn: () => getSubjectInfo(code),
    enabled: !alreadyHasSubject,
    staleTime: 0,
  });

  useEffect(() => {
    if (!subjectInfo) return;
    const filteredSubjects = subjects?.filter(s => s.id !== subject.id) ?? [];
    setValue('subjects', [
      ...filteredSubjects,
      { ...subjectInfo, id: subject.id },
    ]);

    const populatedClasses =
      subjectInfo.classes?.map((c: any) => ({
        ...c,
        subject_id: subject.id,
      })) ?? [];
    const classesWithoutConflict = populatedClasses.filter((c: any) => {
      const parsedSchedules = parseScheduleToGeneratorFormat(c?.schedule ?? []);
      const hasConflictBetweenBusySchedules = hasScheduleConflict(
        parsedSchedules,
        busySchedules,
      );

      return !hasConflictBetweenBusySchedules;
    });
    const filteredSelectedClasses =
      selectedClasses?.filter(c => c.subject_id !== subject.id) ?? [];
    setValue('selectedClasses', [
      ...filteredSelectedClasses,
      ...classesWithoutConflict,
    ]);
  }, [subjectInfo, subjects, subject.id, selectedClasses, busySchedules]);

  const handleRefetchInfo = () => {
    if (errorInfo) {
      refetchInfo();
    }
  };

  const preReqs = (subjectInfo as any)?.prerequisite ?? ([] as Prereq[][]);
  const approvedSubjects = takenSubjects.filter(
    taken => taken.status === 'APPROVED',
  );

  const hasPrerequisites = preReqs.length > 0;

  const isPrereqsSatified =
    !hasPrerequisites ||
    preReqs
      .filter(([prereq]: any) => !prereq?.id?.toUpperCase().includes('TRAVA'))
      .every((prereq: any) =>
        approvedSubjects.some(taken =>
          prereq.some(
            (p: any) => parseSubjectCode(p.id) === parseSubjectCode(taken.id),
          ),
        ),
      );

  const credits = approvedSubjects.reduce(
    (acc, taken) => acc + (Number(taken?.credits) || 0),
    0,
  );

  const isCreditsSatisfied = credits >= (subject.minimum_credits ?? 0);

  const isAbleToTake = isPrereqsSatified && isCreditsSatisfied;

  const notAbleReason = isPrereqsSatified
    ? 'Você não possui créditos suficientes.'
    : 'Você não possui os pré-requisitos necessários.';

  return (
    <Container>
      <TouchableOpacity onPress={handleRefetchInfo}>
        <Row>
          {loadingInfo && !errorInfo && <Spinner size={20} />}
          {!loadingInfo && (
            <Icon
              name={errorInfo || !isAbleToTake ? 'closecircle' : 'checkcircle'}
              color={errorInfo || !isAbleToTake ? COLORS.ERROR : COLORS.SUCCESS}
              size={20}
            />
          )}
          <Text weight="500" size="SM" marginLeft="8px" alignSelf="center">
            {errorInfo && !loadingInfo
              ? `Ocorreu um erro ao buscar informações de ${subject.name}. Toque aqui para tentar novamente.`
              : `Informações: ${subject.name}`}
          </Text>
          {!isAbleToTake && (
            <Text size="XS" marginLeft="8px" alignSelf="center">
              {notAbleReason}
            </Text>
          )}
        </Row>
      </TouchableOpacity>
    </Container>
  );
};

export default SubjectDataFetcher;
