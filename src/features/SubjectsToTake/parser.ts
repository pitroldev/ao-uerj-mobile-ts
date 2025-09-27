const cheerio = require('react-native-cheerio');
import {
  parseSubjectName,
  parseSubjectID,
  parseSimNaoToBoolean,
  parseUerjNumber,
} from '@services/parser/minorParser';

import { SubjectToTake } from './types';

function testTable7(html: string) {
  const groupRegex = /\D+\d+\W-->\D+\d+/g;
  const $ = cheerio.load(html);
  let isGroupTable = false;
  $('table')
    .eq(7)
    .find('td')
    .text((index: number, text: string) => {
      if (!isGroupTable) {
        isGroupTable = groupRegex.test(text);
      }
    });

  return isGroupTable;
}

export default function parseSubjectsToTake(html: string) {
  try {
    const $ = cheerio.load(html);
    const disciplinas: SubjectToTake[] = [];

    // Disciplinas Obrigatórias
    let obrigatoriasObj = {} as Partial<SubjectToTake>;
    $('table')
      .eq(5)
      .find('td')
      .text((index: number, text: string) => {
        if (index % 7 === 0) {
          obrigatoriasObj = {};
          obrigatoriasObj.name = parseSubjectName(text);
          obrigatoriasObj.id = parseSubjectID(text);
        }
        if ((index - 1) % 7 === 0) {
          obrigatoriasObj.branch = text;
        }
        if ((index - 3) % 7 === 0) {
          obrigatoriasObj.period = parseUerjNumber(text) || null;
        }
        if ((index - 4) % 7 === 0) {
          obrigatoriasObj.allow_conflict = !!parseSimNaoToBoolean(text);
        }
        if ((index - 5) % 7 === 0) {
          obrigatoriasObj.minimum_credits = parseUerjNumber(text) || 0;
        }
        if ((index - 6) % 7 === 0) {
          obrigatoriasObj.has_prerequisites = !!parseSimNaoToBoolean(text);
          obrigatoriasObj.type = 'MANDATORY';
          disciplinas.push(obrigatoriasObj as SubjectToTake);
        }
      });

    // Disciplinas Eletivas Restritas
    let restritasObj = {} as Partial<SubjectToTake>;
    $('table')
      .eq(6)
      .find('td')
      .text((index: number, text: string) => {
        if (index % 8 === 0) {
          restritasObj = {};
          restritasObj.name = parseSubjectName(text);
          restritasObj.id = parseSubjectID(text);
        }
        if ((index - 1) % 8 === 0) {
          restritasObj.branch = text;
        }
        if ((index - 2) % 8 === 0) {
          restritasObj.group = text;
        }
        if ((index - 4) % 8 === 0) {
          obrigatoriasObj.period = parseUerjNumber(text) || null;
        }
        if ((index - 5) % 8 === 0) {
          restritasObj.allow_conflict = !!parseSimNaoToBoolean(text);
        }
        if ((index - 6) % 8 === 0) {
          restritasObj.minimum_credits = parseUerjNumber(text) || 0;
        }
        if ((index - 7) % 8 === 0) {
          restritasObj.has_prerequisites = !!parseSimNaoToBoolean(text);
          restritasObj.type = 'RESTRICTED';
          disciplinas.push(restritasObj as SubjectToTake);
        }
      });

    const isTable7Group = testTable7(html);

    // Disciplinas Eletivas Definidas
    let definidasObj = {} as Partial<SubjectToTake>;
    $('table')
      .eq(isTable7Group ? 8 : 7) // Workaround
      .find('td')
      .text((index: number, text: string) => {
        if (index % 6 === 0) {
          definidasObj = {};
          definidasObj.name = parseSubjectName(text);
          definidasObj.id = parseSubjectID(text);
        }
        if ((index - 2) % 6 === 0) {
          definidasObj.period = parseUerjNumber(text) || null;
        }
        if ((index - 3) % 6 === 0) {
          definidasObj.allow_conflict = !!parseSimNaoToBoolean(text);
        }
        if ((index - 4) % 6 === 0) {
          definidasObj.minimum_credits = parseUerjNumber(text) || 0;
        }
        if ((index - 5) % 6 === 0) {
          definidasObj.has_prerequisites = !!parseSimNaoToBoolean(text);
          definidasObj.type = 'DEFINED';
          disciplinas.push(definidasObj as SubjectToTake);
        }
      });

    return disciplinas;
  } catch (err) {
    throw new Error('ParseError');
  }
}
