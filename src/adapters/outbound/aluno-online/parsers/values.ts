import { requireStructure, requiredNumber } from './contract';
export function parseSubjectID(text: string) {
  try {
    const regex = /\w+-[0-9]+/g;
    const [codigo] = regex.exec(text) ?? [text];
    return codigo;
  } catch {
    return text;
  }
}

export function parseSubjectCode(text: string): number {
  const code = text.match(/\b[0-9]+/)?.[0];
  requireStructure(code);
  return requiredNumber(code);
}

export function parseSimNaoToBoolean(text: string): boolean {
  const match = text.match(/(NÃO|SIM)/i)?.[0];
  requireStructure(match);
  return /^sim$/i.test(match);
}

export function parseTeacherName(name: string) {
  try {
    let splitStr = name.toLowerCase().replace(' , ', ', ').split(' ');
    for (let i = 0; i < splitStr.length; i++) {
      splitStr[i] =
        splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }

    splitStr.map((item, index) => {
      if (
        item === 'E' ||
        item === 'Em' ||
        item === 'De' ||
        item === 'Da' ||
        item === 'Do' ||
        item === 'Dos' ||
        item === 'Das' ||
        item === 'Na' ||
        item === 'No' ||
        item === 'Do' ||
        item === 'P/' ||
        item === 'Por' ||
        item === 'Ao' ||
        item === 'À'
      ) {
        splitStr[index] = item.toLowerCase();
      }
    });

    const cleanedString = splitStr.filter(string => string);

    return cleanedString.join(' ');
  } catch {
    return name;
  }
}

export function parseSubjectName(text: string, isClean = false) {
  try {
    const cleanedText = isClean
      ? text
      : text.replace(parseSubjectID(text), '').replace(/-(?=\w)/g, ' - ');
    const regex = /[-,a-zA-Z\u00C0-\u00FF �/.]+\b/g;
    const [match] = regex.exec(cleanedText) ?? [text];
    const preParsed = match.trim();

    const romans = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
      'XIII',
      'XIV',
      'XV',
      'XVI',
      'XVII',
      'XVIII',
      'IX',
      'XX',
    ];
    const splittedText = parseTeacherName(preParsed).split(/\s/g);
    splittedText.map((item, index) => {
      romans.find(romanNumber => {
        if (romanNumber === item.toUpperCase()) {
          splittedText[index] = item.toUpperCase();
        }
      });
    });

    const parsedName = splittedText.join(' ').replace(/^-/g, '').trim();
    return parsedName;
  } catch {
    return text;
  }
}

export function parseSubjectType(text: string) {
  const lowerCase = text.toLowerCase();
  if (lowerCase.includes('obri')) {
    return 'MANDATORY';
  }
  if (lowerCase.includes('defini')) {
    return 'DEFINED';
  }
  if (lowerCase.includes('univ')) {
    return 'UNIVERSAL';
  }
  if (lowerCase.includes('restri')) {
    return 'RESTRICTED';
  }
  return text;
}
