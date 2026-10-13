import { optionalNumber } from './contract';
import { loadHtml, type Cheerio, type CheerioAPI, type Element } from '../html';

import {
  parseSubjectCode,
  parseTeacherName,
  parseSimNaoToBoolean,
} from './values';

import { orderTurnosStringToArray, searchForBreakPonts } from '@utils/horarios';

import { WeekDay } from '@root/types/dateStuff';

import {
  Horario,
  SubjectClassesSchedule,
} from '@root/modules/academics/domain/models';

const parseVacancyNumber = (text: string) => optionalNumber(text) ?? 0;

function parseHorarioArray(horarioString: string) {
  if (!horarioString || typeof horarioString !== 'string') {
    return [];
  }

  const regex = /\D{3}\b/g;
  const splittedString = horarioString.replace('\n', '') || '';

  const dias = splittedString.match(regex) as WeekDay[];
  if (!dias || !Array.isArray(dias)) {
    return [];
  }

  dias.forEach((dia: string, i: number) => {
    switch (dia) {
      case 'SEG':
        dias[i] = 'Segunda';
        break;
      case 'TER':
        dias[i] = 'Terça';
        break;
      case 'QUA':
        dias[i] = 'Quarta';
        break;
      case 'QUI':
        dias[i] = 'Quinta';
        break;
      case 'SEX':
        dias[i] = 'Sexta';
        break;
      case 'SAB':
        dias[i] = 'Sábado';
        break;
      case 'DOM':
        dias[i] = 'Domingo';
        break;
      default:
        dias[i] = dia as WeekDay;
    }
  });

  let cleanedString = splittedString.split(regex);
  cleanedString = cleanedString.filter(item => item && item.trim());

  const horariosArray: Horario[] = [];
  dias.forEach((dia, i) => {
    if (cleanedString[i]) {
      horariosArray.push({
        [dia]: searchForBreakPonts(orderTurnosStringToArray(cleanedString[i])),
      });
    }
  });

  return horariosArray;
}

const getTurmaBasicInfo = ($: CheerioAPI, turma: Cheerio<Element>) => {
  let turmasObj = {
    vacancies: {
      uerj: {},
      freshman: {},
    },
  } as SubjectClassesSchedule;

  // Informações básicas da Turma. A busca inclui o próprio nó da turma, como
  // quando cada turma era carregada como um documento à parte.
  const infoNodes = turma
    .find('div[style*="width:58%"]')
    .addBack('div[style*="width:58%"]');
  infoNodes.each((infoIndex, infoNode) => {
    const isOutOfRange = infoIndex > 0;
    if (isOutOfRange) {
      return;
    }
    const rawTurmaText = $(infoNode)
      .find(
        'div[style*="width:50%;text-align:left;float:left; margin-top: 5px;"]:nth-child(1)',
      )
      .text();
    turmasObj.classNumber = parseSubjectCode(rawTurmaText);

    const rawPreferencialText = $(infoNode)
      .find(
        'div[style*="width:50%;text-align:left;float:left; margin-top: 5px;"]:nth-child(2)',
      )
      .text();

    turmasObj.hasPreference = parseSimNaoToBoolean(rawPreferencialText);
    const rawHorarioItemsText = [] as string[];
    $(infoNode)
      .find('div[style*="width:86%;text-align:left;float:left;"]')
      .first()
      .find('div')
      .each((horarioIndex, horarioNode) => {
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
      ?.split('<br>')
      .map(c => {
        const $$ = loadHtml('<p>' + c + '</p>');
        const rawTeacherName = $$('p').text().trim();

        return parseTeacherName(rawTeacherName);
      });
    turmasObj.teachers = parsedTeachers ?? [];
  });

  // Vagas Atualizadas da Turma UERJ
  turma
    .find('div table:nth-child(1) tr:nth-child(2) td+ td')
    .each((i, cell) => {
      const isAvailableType = i === 0;
      const isTakenType = i === 1;
      const parsedNumber = parseVacancyNumber($(cell).text());

      if (isAvailableType) {
        turmasObj.vacancies.uerj.available = parsedNumber;
      }
      if (isTakenType) {
        turmasObj.vacancies.uerj.taken = parsedNumber;
      }
    });

  // Vagas Atualizadas da Turma Vestibular
  turma
    .find('div table:nth-child(2) tr:nth-child(3) td+ td')
    .each((i, cell) => {
      const isAvailableType = i === 0;
      const isTakenType = i === 1;
      const parsedNumber = parseVacancyNumber($(cell).text());

      if (isAvailableType) {
        turmasObj.vacancies.freshman.available = parsedNumber;
      }
      if (isTakenType) {
        turmasObj.vacancies.freshman.taken = parsedNumber;
      }
    });

  // Vagas para Solicitação de Inscrição UERJ
  turma
    .find('div table:nth-child(2) tr:nth-child(3) td+ td')
    .each((i, cell) => {
      const isRequestedAvailableType = i === 0;
      const isRequestedTakenType = i === 1;
      const isPreferentialType = i === 2;
      const parsedNumber = parseVacancyNumber($(cell).text());

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
  turma
    .find('div table:nth-child(2) tr:nth-child(4) td+ td')
    .each((i, cell) => {
      const isRequestedAvailableType = i === 0;
      const isRequestedTakenType = i === 1;
      const isPreferentialType = i === 2;
      const parsedNumber = parseVacancyNumber($(cell).text());

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

export function parseSubjectClassesSchedule($: CheerioAPI) {
  try {
    const turmasArray: SubjectClassesSchedule[] = [];
    $(
      '.divContentBlock:nth-child(3) .divContentBlockBody > table > tbody > tr > td > div',
    ).each((_turmaIndex, turmaNode) => {
      const turmaBasicInfo = getTurmaBasicInfo($, $(turmaNode));
      turmasArray.push(turmaBasicInfo);
    });

    return turmasArray;
  } catch {
    throw new Error('ParseError');
  }
}
