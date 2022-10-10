import {UERJ_UNIT_OPTIONS} from '@utils/constants/unitOptions';

import {SubjectByUnit, DepartmentOptions} from './types';

const cheerio = require('react-native-cheerio');

import {
  parseSubjectName,
  parseSubjectID,
  parseUnidadeAcademica,
} from '@services/parser/minorParser';

export default function parseClassSchedulesByDepartment(html: string) {
  try {
    const $ = cheerio.load(html);

    const disciplinasArray: SubjectByUnit[] = [];
    let disciplinasObj = {} as Partial<SubjectByUnit>;
    const $disciplinas = $('select').last().find('option');
    $disciplinas.text((index: number, disciplina: string) => {
      disciplinasObj = {};
      disciplinasObj.id = parseSubjectID(disciplina);
      disciplinasObj.name = parseSubjectName(disciplina);
      disciplinasArray.push(disciplinasObj as SubjectByUnit);
    });

    const optionsArray: DepartmentOptions[] = [];
    let optionsObj = {} as Partial<DepartmentOptions>;
    const $options = $('select').first().find('option');
    $options.val((index: number, value: string) => {
      optionsObj = {};
      optionsObj.value = value;
      optionsObj.text = parseUnidadeAcademica($options.eq(index).text());
      optionsObj.selected = $options.eq(index).prop('selected');

      optionsArray.push(optionsObj as DepartmentOptions);
    });

    const data = {
      subjects: disciplinasArray,
      options: optionsArray.length > 30 ? optionsArray : UERJ_UNIT_OPTIONS,
    };
    return data;
  } catch (err) {
    throw new Error('ParseError');
  }
}
