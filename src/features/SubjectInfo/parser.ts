const cheerio = require('react-native-cheerio');

import {
  parseSubjectName,
  parseSubjectID,
  parseSimNaoToBoolean,
  parseSubjectCode,
} from '@services/parser/minorParser';

import { SubjectInfo } from './types';
import parseSubjectClassesSchedule from './schedule-parser';

const INFO_DIV_INDEX_MAP = {
  0: 'NAME_AND_ID',
  1: 'CREDITS_AND_WORKLOAD',
  2: 'FLAGS',
  3: 'APPROVATION_TYPE_AND_DURATION',
} as const;

type InfoDivIndex = keyof typeof INFO_DIV_INDEX_MAP;

const parseBasicSubjectInfo = (html: string) => {
  const $ = cheerio.load(html);

  // Informações da Disciplina
  let infoObj = {} as {
    id?: string;
    code?: number;
    name?: string;
    credits?: number;
    workload?: number;
    timesPerWeek?: number;
    universal?: boolean;
    conflito?: boolean;
    preparo?: boolean;
    approvation_type?: string;
    duration?: string;
  };
  $('.divContentBoxBody > div > div').each(
    (infoIndex: number, infoNode: string) => {
      const isOutOfRange = infoIndex > 3;
      if (isOutOfRange) {
        return;
      }

      const infoDivType = INFO_DIV_INDEX_MAP[infoIndex as InfoDivIndex];
      const infoText = $(infoNode).text() || '';

      if (infoDivType === 'NAME_AND_ID') {
        const disciplina = infoText.replace('Disciplina: ', '') || '';
        if (disciplina) {
          infoObj.id = parseSubjectID(disciplina);
          infoObj.code = parseSubjectCode(disciplina) as number;
          infoObj.name = parseSubjectName(disciplina);
        }
        return;
      }
      if (infoDivType === 'CREDITS_AND_WORKLOAD') {
        const numbers = infoText
          .replace(/\D+/g, ' ')
          .trim()
          .split(' ')
          .filter(Boolean);
        infoObj.credits = numbers[0] ? parseInt(numbers[0], 10) || 0 : 0;
        infoObj.workload = numbers[1] ? parseInt(numbers[1], 10) || 0 : 0;
        infoObj.timesPerWeek = numbers[2] ? parseInt(numbers[2], 10) || 0 : 0;
        return;
      }
      if (infoDivType === 'FLAGS') {
        const res: string[] = [];
        const texts = infoText.split('? ');
        texts.shift();
        texts.forEach((str: string) => {
          if (str && str.length >= 3) {
            res.push(str.slice(0, 3));
          }
        });
        infoObj.universal = res[0] ? !!parseSimNaoToBoolean(res[0]) : false;
        infoObj.conflito = res[1] ? !!parseSimNaoToBoolean(res[1]) : false;
        infoObj.preparo = res[2] ? !!parseSimNaoToBoolean(res[2]) : false;
        return;
      }
      if (infoDivType === 'APPROVATION_TYPE_AND_DURATION') {
        const texts = infoText
          .replace('Tipo de Aprovação', '')
          .replace('Tempo de Duração', '')
          .split(': ')
          .filter(Boolean);

        texts.shift();
        infoObj.approvation_type = texts[0]?.trim() || '';
        infoObj.duration = texts[1]?.trim() || '';
        return;
      }
    },
  );

  return infoObj;
};

const parseSubjectPrerequisite = (html: string) => {
  const $ = cheerio.load(html);

  const prereqArray: SubjectInfo['prerequisite'] = [];
  $('.divContentBlock:nth-child(2) .divContentBlockBody > div > div').text(
    (_: number, preReqText: string) => {
      const isPreReq = preReqText.includes('Pré-Requisito');
      if (isPreReq) {
        const rawPreReqText = preReqText.replace('Pré-Requisito:', '').trim();

        prereqArray.push(
          rawPreReqText.split(' ou ').map(text => ({
            name: parseSubjectName(text),
            id: parseSubjectID(text),
          })),
        );

        return;
      }

      const isTrava = preReqText.includes('Trava');
      if (isTrava) {
        const rawTravaText = preReqText.replace('Trava:', '').trim();
        prereqArray.push([
          {
            name: parseSubjectName(rawTravaText),
            id: 'Trava de Créditos',
          },
        ]);

        return;
      }
    },
  );

  return prereqArray;
};

export default function parseSubjectInfo(html: string) {
  try {
    if (!html || typeof html !== 'string') {
      throw new Error('INVALID_HTML_INPUT');
    }

    const basicInfo = parseBasicSubjectInfo(html);
    const prerequisite = parseSubjectPrerequisite(html);
    const classes = parseSubjectClassesSchedule(html);

    const result = {
      ...basicInfo,
      prerequisite,
      classes,
    };

    return result;
  } catch (err) {
    if (__DEV__) {
      console.error('[parseSubjectInfo] Parse error:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        htmlLength: html?.length || 0,
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
    throw new Error('PARSE_ERROR');
  }
}
