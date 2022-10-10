const cheerio = require('react-native-cheerio');
import {
  parseCodigo,
  parseDocenteName,
  parseSimNaoToBoolean,
} from '../../services/parser/minorParser';

import {orderTurnosStringToArray, searchForBreakPonts} from '@utils/horarios';
import {Horario, SubjectClassesSchedule} from './types';
import {WeekDay} from '@root/types/dateStuff';

function getHorarioArray(horarioString: string) {
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

export default function parseSubjectClassesSchedule(html: string) {
  try {
    const $ = cheerio.load(html);

    const turmasArray: SubjectClassesSchedule[] = [];
    let turmasObj = {} as SubjectClassesSchedule;
    let temp: any[] = [];
    $('div td').each((index: number, item: any) => {
      $(item).text((a: number, b: any) => {
        if (b.length > 100) {
          temp = [];
          $(item)
            .find('div')
            .each((c: number, d: any) => {
              if (c === 2) {
                const dd = $(d).html().replace('<br>', '#');

                $(dd)
                  .find('div')
                  .text((e: number, f: any) => {
                    temp.push(f.trim());

                    if (e === $(d).find('div').length - 11) {
                      turmasObj.location = f.trim() || 'Não Informado';
                    }
                  });
              }
            });

          turmasObj.classNumber = parseCodigo(temp[0]);
          turmasObj.hasPreference = parseSimNaoToBoolean(temp[1]);
          turmasObj.schedule = getHorarioArray(temp[3].replace('#', '\n'));
          turmasArray.push(turmasObj);
          turmasObj = {};
        }
      });
    });

    // DOCENTES
    $('div:nth-child(8) div+ div').each((hindex: number, childHtml: any) => {
      let docentes: string[] = [];
      childHtml.children.map(
        (docenteChildren: any, index: number) =>
          index % 2 === 0 &&
          docentes.push(parseDocenteName(docenteChildren.data)),
      );
      turmasArray[hindex].teachers = docentes;
    });

    turmasArray.forEach(c => {
      c.vacancies = {
        uerj: {},
        freshman: {},
      };
    });

    // Vagas Atualizadas da Turma UERJ
    $('div table:nth-child(1) tr:nth-child(2) td+ td').text(
      (vatuI: number, text: string) => {
        if (vatuI % 2 === 0) {
          turmasArray[vatuI / 2].vacancies.uerj.available = parseInt(text, 10);
        } else {
          turmasArray[(vatuI - 1) / 2].vacancies.uerj.taken = parseInt(
            text,
            10,
          );
        }
      },
    );

    // Vagas Atualizadas da Turma Vestibular
    $('div table:nth-child(1) tr~ tr+ tr td+ td').text(
      (vatvI: number, text: string) => {
        if (vatvI % 2 === 0) {
          turmasArray[vatvI / 2].vacancies.freshman.available = parseInt(
            text,
            10,
          );
        } else {
          turmasArray[(vatvI - 1) / 2].vacancies.freshman.taken = parseInt(
            text,
            10,
          );
        }
      },
    );

    // Vagas para Solicitação de Inscrição UERJ
    $('div+ table tr:nth-child(3) td+ td').text(
      (vsivI: number, text: string) => {
        if (vsivI % 3 === 0) {
          turmasArray[vsivI / 3].vacancies.uerj.requestedAvailable = parseInt(
            text,
            10,
          );
        }
        if ((vsivI - 1) % 3 === 0) {
          turmasArray[(vsivI - 1) / 3].vacancies.uerj.requestedTaken = parseInt(
            text,
            10,
          );
        }
        if ((vsivI - 2) % 3 === 0) {
          turmasArray[(vsivI - 2) / 3].vacancies.uerj.preferential = parseInt(
            text,
            10,
          );
        }
      },
    );

    // Vagas para Solicitação de Inscrição Vestibular
    $('div div tr:nth-child(4) td+ td').text((vsivI: number, text: string) => {
      if (vsivI % 3 === 0) {
        turmasArray[vsivI / 3].vacancies.freshman.requestedAvailable = parseInt(
          text,
          10,
        );
      }
      if ((vsivI - 1) % 3 === 0) {
        turmasArray[(vsivI - 1) / 3].vacancies.freshman.requestedTaken =
          parseInt(text, 10);
      }
      if ((vsivI - 2) % 3 === 0) {
        turmasArray[(vsivI - 2) / 3].vacancies.freshman.preferential = parseInt(
          text,
          10,
        );
      }
    });

    return turmasArray;
  } catch (err) {
    throw new Error('ParseError');
  }
}
