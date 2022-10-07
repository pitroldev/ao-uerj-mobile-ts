import React from 'react';

import {useAppDispatch, useAppSelector} from '@root/store';
import * as subjectReducer from '@root/reducers/subjectClassesSearch';
import * as userReducer from '@root/reducers/userInfo';

import {SubjectClassesSchedule} from '@root/types/subjectClassesSchedule';
import {SubjectInfo} from '@root/types/subjectInfo';

import parser from '@root/services/parser';

import SubjectSearch from './SubjectSearch';
import SubjectView from './SubjectView';
import {
  getSubjectClassesSchedule,
  getSubjectInfo,
} from '@root/services/UerjApi';

const SubjectDetailPage = () => {
  const dispatch = useAppDispatch();

  const {periodo} = useAppSelector(userReducer.selectUserInfo);
  const {selected, data} = useAppSelector(
    subjectReducer.selectSubjectClassesSearch,
  );

  const handleSubjectInfo = (subject: SubjectInfo, code: number) => {
    if (!subject || subject.id === 'UERJ00-00000') {
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
    const code = parser.parseCodigo(subjectCode);
    if (typeof code !== 'number') {
      throw new Error('INVALID_SUBJECT_CODE');
    }

    dispatch(subjectReducer.select({code, periodo}));
    return code;
  };

  const searchSubject = async (
    subjectCode: string | number,
    skipCache = false,
  ) => {
    try {
      const code = handleSubjectCode(subjectCode);

      const cached = data.find(d => d.code === code);
      if (!skipCache && cached && cached.periodo === periodo) {
        dispatch(subjectReducer.select(cached));
        return;
      }

      await Promise.all([
        getSubjectInfo(code).then(res => handleSubjectInfo(res, code)),
        getSubjectClassesSchedule(code).then(res =>
          handleClassesSchedule(res, code),
        ),
      ]);
    } catch (err) {
      console.log('handleSearch', err);
      // TODO: Disciplina não encontrada, por favor verifique se blablabla
    }
  };

  if (selected) {
    return <SubjectView searchSubject={searchSubject} {...selected} />;
  }

  return <SubjectSearch searchSubject={handleSubjectCode} />;
};

export default SubjectDetailPage;
