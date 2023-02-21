import {UERJ_UNIT_OPTIONS} from '@utils/constants/unitOptions';

import {UniversalSubject} from '@features/UniversalSubjects/types';

import {DepartmentOptions} from './types';

const cheerio = require('react-native-cheerio');

import {
  parseSubjectName,
  parseSubjectID,
  parseSimNaoToBoolean,
  parseUnidadeAcademica,
  parseUerjNumber,
} from '@services/parser/minorParser';

export default function parseUniversalSubjects(html: string) {
  try {
    const $ = cheerio.load(html);

    const disciplinasArray: UniversalSubject[] = [];
    let disciplinasObj = {} as Partial<UniversalSubject>;
    $('#id_th~ tr td').text((index: number, text: string) => {
      if (index % 6 === 0) {
        disciplinasObj = {type: 'UNIVERSAL'};
        disciplinasObj.name = parseSubjectName(text);
        disciplinasObj.id = parseSubjectID(text);
      }
      if ((index - 3) % 6 === 0) {
        disciplinasObj.allow_conflict = !parseSimNaoToBoolean(text);
      }
      if ((index - 4) % 6 === 0) {
        disciplinasObj.minimum_credits = parseUerjNumber(text) || 0;
      }
      if ((index - 5) % 6 === 0) {
        disciplinasObj.has_prerequisites = parseSimNaoToBoolean(text);
        disciplinasArray.push(disciplinasObj as UniversalSubject);
      }
    });

    const optionsArray: DepartmentOptions[] = [];
    let optionsObj = {} as Partial<DepartmentOptions>;
    const $options = $('option');
    $options.val((index: number, value: string) => {
      optionsObj = {};
      optionsObj.value = value;
      optionsObj.text = parseUnidadeAcademica($options.eq(index).text().trim());
      optionsObj.selected = $options.eq(index).prop('selected');

      optionsArray.push(optionsObj as DepartmentOptions);
    });

    const optionsWorkaround =
      optionsArray.length > 30 ? optionsArray : UERJ_UNIT_OPTIONS;

    const data = {
      subjects: disciplinasArray,
      options: optionsWorkaround,
    };
    return data;
  } catch (err) {
    throw new Error('ParseError');
  }
}
