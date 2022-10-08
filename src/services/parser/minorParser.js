export function parseSubjectID(text) {
  try {
    const regex = /\w+-[0-9]+/g;
    const codigo = regex.exec(text)[0];
    return codigo;
  } catch (e) {
    return text;
  }
}

export function parseCodigo(text) {
  try {
    const regex = /\b[0-9]+/g;
    const codigo = regex.exec(text)[0];
    return parseInt(codigo, 10);
  } catch (e) {
    return text;
  }
}

export function parseSimNaoToBoolean(text) {
  try {
    const regex = /(NÃO|SIM)/gi;
    const resposta = regex.exec(text)[0].toUpperCase();
    if (resposta.charAt(0) === 'S') {
      return true;
    }
    return false;
  } catch (e) {
    return text;
  }
}

export function parseHorarios(horarios) {
  try {
    const horariosObj = {};
    const tempos = [];
    const regex = /[\D]{3}\b/g;

    const parsed = horarios.split(regex);

    parsed.map(item => {
      const parsedTempo = item.trim();
      parsedTempo && tempos.push(parsedTempo.split(/\s/g));
    });

    const diasDaSemana = horarios.match(regex);
    diasDaSemana.map((dia, index) => {
      horariosObj[dia] = tempos[index];
      horariosObj[dia] = horariosObj[dia].sort();
    });

    return horariosObj;
  } catch (e) {
    return horarios;
  }
}

export function parseName(name, NomeCompleto = true) {
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

export function parseUnidadeAcademica(unidadeName) {
  try {
    const [sigla, nome] = unidadeName.trim().split(' - ');

    const parsedName = `${sigla} - ${parseName(nome)}`;

    return parsedName;
  } catch (e) {
    return unidadeName;
  }
}

export function parseDocenteName(nome) {
  try {
    let splitStr = nome.toLowerCase().replace(' , ', ', ').split(' ');
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
    return nome;
  }
}

export function parseSubjectName(text, isClean = false) {
  try {
    const cleanedText = isClean
      ? text
      : text.replace(parseSubjectID(text), '').replace(/-(?=\w)/g, ' - ');
    // const regex1 = /\b[-,a-zA-ZA-\u00ff �/.]+\b/g;
    const regex = /[-,a-zA-Z\u00C0-\u00FF �/.]+\b/g;
    const preParsed = regex.exec(cleanedText)[0].trim();

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
    const splittedText = parseDocenteName(preParsed).split(/\s/g);
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

export function parseNumber(strNumber) {
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

export function getColor(stringNumber) {
  try {
    let num = parseFloat(stringNumber, 10);

    if (num < 0) {
      throw new Error('Invalid Number');
    }

    if (num > 1) {
      return '#FFA6A6';
    }

    if (isNaN(num)) {
      return '#ddd';
    }

    const diff = num * 45;

    const red = 210 + diff;
    const green = 250 - diff;

    const color = 'rgb(' + red + ', ' + green + ', 213)';

    return color;
  } catch (e) {
    return '#aaa';
  }
}

export function parseSubjectType(text) {
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

export function parseUerjNumber(possibleNumber) {
  if (!possibleNumber) {
    return null;
  }

  return parseFloat(possibleNumber.replace('-', '').trim());
}
