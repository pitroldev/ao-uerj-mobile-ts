import React from 'react';
import {useQuery} from 'react-query';
import {useTheme} from 'styled-components';
import {TouchableOpacity} from 'react-native';
import {useFormContext, useWatch} from 'react-hook-form';
import Icon from 'react-native-vector-icons/AntDesign';

import {parseSubjectCode} from '@services/parser/minorParser';

import {Prereq} from '@features/SubjectInfo/types';
import {getSubjectInfo} from '@features/SubjectInfo/core';

import {getSubjectClassesSchedule} from '@features/SubjectClassesSchedule/core';

import {ScheduleCreationParams} from '@features/ScheduleSimulator/types';
import {SubjectToTake} from '@features/SubjectsToTake/types';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';

import {Container, Row} from './SubjectDataFetcher.styles';

const SubjectDataFetcher = (subject: SubjectToTake) => {
  const {COLORS} = useTheme();
  const {control, setValue} = useFormContext<ScheduleCreationParams>();

  const subjects = useWatch({control, name: 'subjects'}) ?? [];
  const classes = useWatch({control, name: 'classes'}) ?? [];
  const takenSubjects = useWatch({control, name: 'takenSubjects'}) ?? [];

  const code = parseSubjectCode(subject.id);

  const {
    isFetching: loadingInfo,
    error: errorInfo,
    refetch: refetchInfo,
    data: subjectInfo,
  } = useQuery({
    queryKey: ['subject-info', code],
    queryFn: () => getSubjectInfo(code),
    onSuccess: info => {
      const filteredSubjects = subjects.filter(s => s.id !== subject.id);
      setValue('subjects', [...filteredSubjects, info]);
    },
  });

  const {
    isFetching: loadingClasses,
    error: errorClasses,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['subject-classes', code],
    queryFn: () => getSubjectClassesSchedule(code),
    onSuccess: subjectClasses => {
      const filteredClasses = classes.filter(s => s.subject_id !== subject.id);
      const populatedClasses = subjectClasses.map(c => ({
        ...c,
        subject_id: subject.id,
      }));

      setValue('classes', [...filteredClasses, ...populatedClasses]);
      setValue('selectedClasses', [...filteredClasses, ...populatedClasses]);
    },
  });

  const handleRefetchInfo = () => {
    if (errorInfo) {
      refetchInfo();
    }
  };

  const handleRefetchClasses = () => {
    if (errorClasses) {
      refetchClasses();
    }
  };

  const preReqs = subjectInfo?.prerequisite ?? ([] as Prereq[][]);
  const hasPrerequisites = preReqs.length > 0;

  const isPrereqsSatified =
    !hasPrerequisites ||
    preReqs.every(prereq =>
      takenSubjects.some(taken =>
        prereq.some(p => parseSubjectCode(p.id) === parseSubjectCode(taken.id)),
      ),
    );

  const credits = takenSubjects
    .filter(taken => taken.status === 'APPROVED')
    .reduce((acc, taken) => acc + (Number(taken?.credits) || 0), 0);

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

      <TouchableOpacity onPress={handleRefetchClasses}>
        <Row>
          {loadingClasses && !errorClasses && <Spinner size={20} />}
          {!loadingClasses && (
            <Icon
              name={
                errorClasses || !isAbleToTake ? 'closecircle' : 'checkcircle'
              }
              color={
                errorClasses || !isAbleToTake ? COLORS.ERROR : COLORS.SUCCESS
              }
              size={20}
            />
          )}
          <Text weight="500" size="SM" marginLeft="8px" alignSelf="center">
            {errorClasses && !loadingClasses
              ? `Ocorreu um erro ao buscar turmas de ${subject.name}. Toque aqui para tentar novamente.`
              : `Turmas: ${subject.name}`}
          </Text>
        </Row>
      </TouchableOpacity>
    </Container>
  );
};

export default SubjectDataFetcher;
