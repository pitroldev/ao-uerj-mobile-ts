import React, {useState} from 'react';
import Toast from 'react-native-toast-message';

import {useAppDispatch, useAppSelector} from '@root/store';

import * as userReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as subjectReducer from '@features/SubjectClassesSchedule/reducer';

import {SubjectClassesSchedule} from '@root/features/SubjectClassesSchedule/types';
import {SubjectInfo} from '@features/SubjectInfo/types';

import parser from '@services/parser';
import {getSubjectClassesSchedule} from '@root/features/SubjectClassesSchedule/core';
import {getSubjectInfo} from '@root/features/SubjectInfo/core';

import SubjectSearch from './SubjectSearch';
import SubjectView from './SubjectView';

const SubjectDetailPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const dispatch = useAppDispatch();

  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {periodo} = useAppSelector(userReducer.selectUserInfo);
  const {selected, data} = useAppSelector(
    subjectReducer.selectSubjectClassesSearch,
  );

  const handleSubjectInfo = (subject: SubjectInfo, code: number) => {
    if (!subject || !subject.id || subject.id === 'UERJ00-00000') {
      dispatch(subjectReducer.clearSelected());
      throw new Error('SUBJECT_NOT_FOUND');
    }

    dispatch(subjectReducer.appendData({subject, periodo, code}));
    dispatch(subjectReducer.appendToSelect({subject, periodo, code}));
  };

  const handleClassesSchedule = (
    classes: SubjectClassesSchedule[],
    code: number,
  ) => {
    if (!classes) {
      throw new Error('CLASSES_NOT_FOUND');
    }

    dispatch(subjectReducer.appendData({classes, periodo, code}));
    dispatch(subjectReducer.appendToSelect({classes, periodo, code}));
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
        dispatch(subjectReducer.select(cached));
        return;
      }

      dispatch(subjectReducer.select({code, periodo}));

      await Promise.all([
        getSubjectInfo(code).then(res => handleSubjectInfo(res, code)),
        getSubjectClassesSchedule(code).then(res =>
          handleClassesSchedule(res, code),
        ),
      ]);
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

  if (selected) {
    return (
      <SubjectView
        searchSubject={handleSubjectCode}
        {...selected}
        error={error}
        loading={loading}
      />
    );
  }

  return <SubjectSearch searchSubject={handleSubjectCode} />;
};

export default SubjectDetailPage;
