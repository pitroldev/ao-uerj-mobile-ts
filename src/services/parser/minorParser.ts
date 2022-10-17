export function parseSubjectID(text: string) {
  try {
    const regex = /\w+-[0-9]+/g;
    const [codigo] = regex.exec(text) ?? [text];
    return codigo;
  } catch (e) {
    return text;
  }
}

export function parseSubjectCode(text: string) {
  try {
    const regex = /\b[0-9]+/g;
    const [codigo] = regex.exec(text) ?? [text];
    return parseInt(codigo, 10);
  } catch (e) {
    return text;
  }
}

export function parseSimNaoToBoolean(text: string) {
  try {
    const regex = /(NÃO|SIM)/gi;
    const [match] = regex.exec(text) ?? [text];
    if (!match) {
      throw new Error();
    }
    const resposta = match.toUpperCase();
    if (resposta.charAt(0) === 'S') {
      return true;
    }
    return false;
  } catch (e) {
    return text;
  }
}

export function parseName(name: string, NomeCompleto = true) {
  try {
    let splitStr = name.trim().toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
      splitStr[i] =
        splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    name = splitStr.join(' ');
    if (NomeCompleto === true) {
      return name;
    }
    const separado = name.split(' ');
    const preposicao = `${separado[1]}`;
    if (preposicao.length <= 3 && separado[2] !== undefined) {
      return `${separado[0]} ${separado[1]} ${separado[2]}`;
    }
    if (separado[1] !== undefined) {
      return `${separado[0]} ${separado[1]}`;
    } else {
      return `${separado[0]}`;
    }
  } catch (e) {
    return name;
  }
}

export function parseUnidadeAcademica(unidadeName: string) {
  try {
    const [sigla, nome] = unidadeName.trim().split(' - ');

    const parsedName = `${sigla} - ${parseName(nome)}`;

    return parsedName;
  } catch (e) {
    return unidadeName;
  }
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

    const cleanedString = splitStr.filter(string => string && string);

    return cleanedString.join(' ');
  } catch (e) {
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
  } catch (e) {
    return text;
  }
}

export function parseNumber(strNumber: string) {
  try {
    if (!strNumber) {
      return '-';
    }
    const parsedNumber = parseFloat(strNumber.trim().replace(',', '.'));
    return parsedNumber;
  } catch (e) {
    return '-';
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

export function parseUerjNumber(possibleNumber: string) {
  if (!possibleNumber) {
    return null;
  }

  return parseFloat(possibleNumber.replace('-', '').trim());
}
