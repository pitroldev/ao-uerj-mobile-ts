const cheerio = require('react-native-cheerio');
import {Prereq} from '@root/types/subjectInfo';
import {
  parseSubjectName,
  parseSubjectID,
  parseSimNaoToBoolean,
} from './minorParser';

import {SubjectInfo} from '../../types/subjectInfo';

function parsePreRequisito(array: string[]): Prereq[] {
  try {
    const prereqArray: Prereq[] = [];
    array.map(text => {
      prereqArray.push({
        name: parseSubjectName(text),
        id: parseSubjectID(text),
      });
    });
    return prereqArray;
  } catch (e) {
    return [];
  }
}
export default function parseSubjectInfo(html: string) {
  try {
    const $ = cheerio.load(html);

    // Informações da Disciplina
    let infoObj = {} as SubjectInfo;
    $('div')
      .eq(2)
      .find('div')
      .text((index: number, text: string) => {
        if (index === 0) {
          const disciplina = text.replace('Disciplina: ', '');
          infoObj.id = parseSubjectID(disciplina);
          infoObj.name = parseSubjectName(disciplina);
        }
        if (index === 1) {
          const numbers = text.replace(/\D+/g, ' ').trim().split(' ');
          infoObj.credits = parseInt(numbers[0], 10);
          infoObj.workload = parseInt(numbers[1], 10);
          infoObj.timesPerWeek = parseInt(numbers[2], 10);
        }
        if (index === 2) {
          const res: string[] = [];
          const texts = text.split('? ');
          texts.shift();
          texts.map(str => {
            res.push(str.slice(0, 3));
          });
          infoObj.universal = parseSimNaoToBoolean(res[0]);
          infoObj.conflito = parseSimNaoToBoolean(res[1]);
          infoObj.preparo = parseSimNaoToBoolean(res[2]);
        }
        if (index === 3) {
          const texts = text
            .replace('Tipo de Aprovação', '')
            .replace('Tempo de Duração', '')
            .split(': ');
          texts.shift();
          infoObj.approvation_type = texts[0].trim();
          infoObj.duration = texts[1].trim();
        }
      });

    // Pre-Requisitos
    const prereqArray: SubjectInfo['prerequisite'] = [];
    $('#id_table')
      .find('td')
      .text((index: number, text: string) => {
        if (index % 2 === 0) {
          return;
        }
        if (text.split('OU').length > 1) {
          prereqArray.push(parsePreRequisito(text.split('OU')));
        } else {
          prereqArray.push([
            {
              name: parseSubjectName(text),
              id: parseSubjectID(text),
            },
          ]);
        }
      });

    infoObj.prerequisite = prereqArray;

    return infoObj;
  } catch (err) {
    throw new Error('ParseError');
  }
}
