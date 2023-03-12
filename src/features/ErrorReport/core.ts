import {AxiosError} from 'axios';

import {_fetchRawAttendedClassesScheduleData} from '@features/AttendedClassesSchedule/core';
import {_fetchRawClassGradesData} from '@features/ClassGrades/core';
import {_fetchRawCurriculumSubjectsData} from '@features/CurriculumSubjects/core';
import {_fetchRawPartialRIDData} from '@features/PartialRID/core';
import {_fetchRawSubjectClassesScheduleData} from '@features/SubjectClassesSchedule/core';
import {_fetchRawSubjectInfoData} from '@features/SubjectInfo/core';
import {_fetchRawSubjectsTakenData} from '@features/SubjectsTaken/core';
import {_fetchRawSubjectsToTakeData} from '@features/SubjectsToTake/core';
import {_fetchRawUniversalSubjectsData} from '@features/UniversalSubjects/core';

import api from '@services/PrivateApi';
import {retry} from '@services/UerjApi/utils';

import {ErrorReportBody, ErrorFeature} from './types';

export const PRIVATE_ROUTES = [
  {
    name: 'Quadro de Horários',
    callbacks: [_fetchRawAttendedClassesScheduleData],
  },
  {
    name: 'Gerador de Quadros',
    callbacks: [],
  },
  {
    name: 'Quadro de Notas',
    callbacks: [_fetchRawClassGradesData],
  },
  {
    name: 'RID Parcial',
    callbacks: [_fetchRawPartialRIDData],
  },
  {
    name: 'Disciplinas do Currículo',
    callbacks: [_fetchRawCurriculumSubjectsData],
  },
  {
    name: 'Disciplinas Universais',
    callbacks: [_fetchRawUniversalSubjectsData],
  },
  {
    name: 'Disciplinas Realizadas',
    callbacks: [_fetchRawSubjectsTakenData],
  },
  {
    name: 'Disciplinas a Cursar',
    callbacks: [_fetchRawSubjectsToTakeData],
  },
  {
    name: 'Pesquisa de Disciplinas',
    callbacks: [],
  },
  {
    name: 'Pesquisa de Professores',
    callbacks: [],
  },
  {
    name: 'Informações de uma disciplina específica',
    callbacks: [_fetchRawSubjectInfoData, _fetchRawSubjectClassesScheduleData],
  },
];

export async function executeErrorCallbacks(
  callbacks: ErrorFeature['callbacks'],
) {
  return await Promise.all(
    callbacks.map(
      async fn => await retry(fn).catch((err: AxiosError) => err.toString()),
    ),
  );
}

export async function sendErrorReport(body: ErrorReportBody) {
  return await api.post('/reportError', body);
}
