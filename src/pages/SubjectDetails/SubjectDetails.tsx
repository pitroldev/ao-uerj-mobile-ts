import React, { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';

import parser from '@services/parser';
import { useAppDispatch, useAppSelector } from '@root/store';

import * as userReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as subjectReducer from '@features/SubjectClassesSchedule/reducer';

import { SubjectInfo } from '@features/SubjectInfo/types';
import { getSubjectInfo } from '@features/SubjectInfo/core';

import SubjectSearch from './SubjectSearch';
import SubjectView from './SubjectView';

const SubjectDetailPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const dispatch = useAppDispatch();

  const { isBlocked } = useAppSelector(apiConfigReducer.selectApiConfig);
  const { periodo } = useAppSelector(userReducer.selectUserInfo);
  const { current, data } = useAppSelector(
    subjectReducer.selectSubjectClassesSearch,
  );

  const handleSubjectInfo = (subject: SubjectInfo, code: number) => {
    if (!subject || !subject.id || subject.id === 'UERJ00-00000') {
      dispatch(subjectReducer.clearCurrent());
      throw new Error('SUBJECT_NOT_FOUND');
    }

    dispatch(subjectReducer.setCurrent({ subject, periodo, code }));
  };

  const handleSubjectCode = (subjectCode: string | number) => {
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Aluno Online bloqueado',
        text2: 'Tente novamente mais tarde.',
      });
      return;
    }

    const code = parser.parseSubjectCode(subjectCode as string);
    if (typeof code !== 'number') {
      throw new Error('INVALID_SUBJECT_CODE');
    }

    searchSubject(code);
  };

  const searchSubject = async (code: number, skipCache = false) => {
    try {
      setLoading(true);
      setError(null);

      const cached = data.find(d => d.code === code);
      if (!skipCache && cached && cached.periodo === periodo) {
        dispatch(subjectReducer.setCurrent(cached));
      } else {
        dispatch(
          subjectReducer.setCurrent({
            periodo,
            code,
          }),
        );
      }

      const subject = await getSubjectInfo(code);
      handleSubjectInfo(subject, code);
    } catch (err) {
      setError(err);
      Toast.show({
        type: 'error',
        text1: 'Não foi possível encontrar esta disciplina',
        text2: 'Certifique-se de que escreveu o código corretamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!current?.code || loading) return;
    if (current?.subject && current.periodo === periodo) return;
    const parsed = parser.parseSubjectCode(current.code as string);
    if (typeof parsed === 'number') {
      searchSubject(parsed, false);
    }
  }, [current?.code, current?.subject, periodo, loading]);

  if (current) {
    return (
      <SubjectView
        searchSubject={handleSubjectCode}
        subject={current?.subject}
        code={current?.code}
        loading={loading}
        error={error}
      />
    );
  }

  return <SubjectSearch searchSubject={handleSubjectCode} />;
};

export default SubjectDetailPage;
