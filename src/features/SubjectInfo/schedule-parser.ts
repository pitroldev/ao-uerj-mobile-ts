const cheerio = require('react-native-cheerio');

import {
  parseSubjectCode,
  parseTeacherName,
  parseSimNaoToBoolean,
} from '@services/parser/minorParser';

import {orderTurnosStringToArray, searchForBreakPonts} from '@utils/horarios';

import {WeekDay} from '@root/types/dateStuff';

import {Horario, SubjectClassesSchedule} from './types';

const parseVacancyNumber = (text: string) => {
  const parsedNumber = parseInt(text?.trim(), 10);
  return isNaN(parsedNumber) ? 0 : parsedNumber || 0;
};

function parseHorarioArray(horarioString: string) {
  try {
    const regex = /\D{3}\b/g;
    const splittedString = horarioString.replace('\n', '');

    const dias = splittedString.match(regex) as WeekDay[];
    if (!dias) {
      return [];
    }

    dias.map((dia: string, i: number) => {
      switch (dia) {
        case 'SEG':
          return (dias[i] = 'Segunda');
        case 'TER':
          return (dias[i] = 'Terça');
        case 'QUA':
          return (dias[i] = 'Quarta');
        case 'QUI':
          return (dias[i] = 'Quinta');
        case 'SEX':
          return (dias[i] = 'Sexta');
        case 'SAB':
          return (dias[i] = 'Sábado');
        case 'DOM':
          return (dias[i] = 'Domingo');
        default:
          return (dias[i] = dia as any);
      }
    });

    let cleanedString = splittedString.split(regex);
    cleanedString = cleanedString.filter(item => item && item);

    const horariosArray: Horario[] = [];
    dias.map((dia, i) => {
      horariosArray.push({
        [dia]: searchForBreakPonts(orderTurnosStringToArray(cleanedString[i])),
      });
    });

    return horariosArray;
  } catch (e) {
    console.error('getHorarioObj', e);
    return [];
  }
}

const getTurmaBasicInfo = (html: string) => {
  const $ = cheerio.load(html);

  let turmasObj = {
    vacancies: {
      uerj: {},
      freshman: {},
    },
  } as SubjectClassesSchedule;

  // Informações básicas da Turma
  $('div[style*="width:58%"]').each((infoIndex: number, infoNode: any) => {
    const isOutOfRange = infoIndex > 0;
    if (isOutOfRange) {
      return;
    }
    const rawTurmaText = $(infoNode)
      .find(
        'div[style*="width:50%;text-align:left;float:left; margin-top: 5px;"]:nth-child(1)',
      )
      .text();
    turmasObj.classNumber = parseSubjectCode(rawTurmaText) as number;

    const rawPreferencialText = $(infoNode)
      .find(
        'div[style*="width:50%;text-align:left;float:left; margin-top: 5px;"]:nth-child(2)',
      )
      .text();

    turmasObj.hasPreference = parseSimNaoToBoolean(
      rawPreferencialText,
    ) as boolean;
    const rawHorarioItemsText = [] as string[];
    $(infoNode)
      .find('div[style*="width:86%;text-align:left;float:left;"]')
      .first()
      .find('div')
      .each((horarioIndex: number, horarioNode: any) => {
        const itemText = $(horarioNode).text().trim();

        const arrIndex =
          horarioIndex % 2 === 0 ? horarioIndex / 2 : (horarioIndex - 1) / 2;

        const currItem = rawHorarioItemsText[arrIndex];
        if (!currItem) {
          rawHorarioItemsText.push($(horarioNode).text());
          return;
        }

        rawHorarioItemsText[arrIndex] = currItem + ' ' + itemText;
      });
    turmasObj.schedule = parseHorarioArray(rawHorarioItemsText.join('\n'));

    const rawLocationText = $(infoNode)
      .find('div[style*="width:74%;text-align:left;float:left;"]')
      .text()
      .trim();
    turmasObj.location = rawLocationText;

    const parsedTeachers = $(infoNode)
      .find('div[style*="width:86%;text-align:left;float:left;"]')
      .eq(1)
      .html()
      .split('<br>')
      .map((c: string) => {
        const $$ = cheerio.load('<p>' + c + '</p>');
        const rawTeacherName = $$('p').text().trim();

        return parseTeacherName(rawTeacherName);
      });
    turmasObj.teachers = parsedTeachers;
  });

  // Vagas Atualizadas da Turma UERJ
  $(html)
    .find('div table:nth-child(1) tr:nth-child(2) td+ td')
    .text((i: number, text: string) => {
      const isAvailableType = i === 0;
      const isTakenType = i === 1;
      const parsedNumber = parseVacancyNumber(text);

      if (isAvailableType) {
        turmasObj.vacancies.uerj.available = parsedNumber;
      }
      if (isTakenType) {
        turmasObj.vacancies.uerj.taken = parsedNumber;
      }
    });

  // Vagas Atualizadas da Turma Vestibular
  $(html)
    .find('div table:nth-child(2) tr:nth-child(3) td+ td')
    .text((i: number, text: string) => {
      const isAvailableType = i === 0;
      const isTakenType = i === 1;
      const parsedNumber = parseVacancyNumber(text);

      if (isAvailableType) {
        turmasObj.vacancies.freshman.available = parsedNumber;
      }
      if (isTakenType) {
        turmasObj.vacancies.freshman.taken = parsedNumber;
      }
    });

  // Vagas para Solicitação de Inscrição UERJ
  $(html)
    .find('div table:nth-child(2) tr:nth-child(3) td+ td')
    .text((i: number, text: string) => {
      const isRequestedAvailableType = i === 0;
      const isRequestedTakenType = i === 1;
      const isPreferentialType = i === 2;
      const parsedNumber = parseVacancyNumber(text);

      if (isRequestedAvailableType) {
        turmasObj.vacancies.uerj.requestedAvailable = parsedNumber;
      }
      if (isRequestedTakenType) {
        turmasObj.vacancies.uerj.requestedTaken = parsedNumber;
      }
      if (isPreferentialType) {
        turmasObj.vacancies.uerj.preferential = parsedNumber;
      }
    });

  // Vagas para Solicitação de Inscrição Vestibular
  $(html)
    .find('div table:nth-child(2) tr:nth-child(4) td+ td')
    .text((i: number, text: string) => {
      const isRequestedAvailableType = i === 0;
      const isRequestedTakenType = i === 1;
      const isPreferentialType = i === 2;
      const parsedNumber = parseVacancyNumber(text);

      if (isRequestedAvailableType) {
        turmasObj.vacancies.freshman.requestedAvailable = parsedNumber;
      }
      if (isRequestedTakenType) {
        turmasObj.vacancies.freshman.requestedTaken = parsedNumber;
      }
      if (isPreferentialType) {
        turmasObj.vacancies.freshman.preferential = parsedNumber;
      }
    });

  return turmasObj;
};

export default function parseSubjectClassesSchedule(html: string) {
  try {
    const $ = cheerio.load(html);

    const turmasArray: SubjectClassesSchedule[] = [];
    $(
      '.divContentBlock:nth-child(3) .divContentBlockBody > table > tbody > tr > td > div',
    ).each((turmaIndex: number, turmaNode: any) => {
      const turmaBasicInfo = getTurmaBasicInfo(turmaNode);
      turmasArray.push(turmaBasicInfo);
    });

    return turmasArray;
  } catch (err) {
    console.error('parseSubjectClassesSchedule', err);
    throw new Error('ParseError');
  }
}
