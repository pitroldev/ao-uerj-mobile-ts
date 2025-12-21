import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components';
import { TouchableOpacity } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import { AntDesign as Icon } from '@react-native-vector-icons/ant-design';

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

type Props = CurriculumSubject & {
  onSubjectLoaded?: (subjectId: string) => void;
  onSubjectError?: (subjectId: string) => void;
};

const SubjectDataFetcher = (props: Props) => {
  const { onSubjectLoaded, onSubjectError, ...subject } = props;

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
  });

  useEffect(() => {
    if (!subjectInfo) return;
    const filteredSubjects = subjects?.filter(s => s.id !== subject.id) ?? [];
    setValue('subjects', [
      ...filteredSubjects,
      { ...subjectInfo, id: subject.id },
    ]);

    const populatedClasses =
      subjectInfo.classes?.map(c => ({
        ...c,
        subject_id: subject.id,
      })) ?? [];
    const classesWithoutConflict = populatedClasses.filter(c => {
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
  }, [subjectInfo]);

  const handleRefetchInfo = () => {
    if (errorInfo) {
      refetchInfo();
    }
  };

  const preReqs = subjectInfo?.prerequisite ?? ([] as Prereq[][]);
  const approvedSubjects = takenSubjects.filter(
    taken => taken.status === 'APPROVED',
  );

  const hasPrerequisites = preReqs.length > 0;

  const isPrereqsSatified =
    !hasPrerequisites ||
    preReqs
      .filter(([prereq]) => !prereq?.id?.toUpperCase().includes('TRAVA'))
      .every(prereq =>
        approvedSubjects.some(taken =>
          prereq.some(
            p => parseSubjectCode(p.id) === parseSubjectCode(taken.id),
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

  useEffect(() => {
    if (!loadingInfo) {
      if (errorInfo && onSubjectError) {
        onSubjectError(subject.id);
      } else if (!errorInfo && onSubjectLoaded) {
        onSubjectLoaded(subject.id);
      }
    }
  }, [loadingInfo, errorInfo, subject.id, onSubjectLoaded, onSubjectError]);

  useEffect(() => {
    if (alreadyHasSubject && onSubjectLoaded) {
      onSubjectLoaded(subject.id);
    }
  }, [alreadyHasSubject, subject.id, onSubjectLoaded]);

  return (
    <Container>
      <TouchableOpacity onPress={handleRefetchInfo}>
        <Row>
          {loadingInfo && !errorInfo && <Spinner size={20} />}
          {!loadingInfo && (
            <Icon
              name={
                errorInfo || !isAbleToTake ? 'close-circle' : 'check-circle'
              }
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
