const cheerio = require('react-native-cheerio');
import {parseSubjectName, parseNumber} from './minorParser';

export default function notasParciais(html) {
  try {
    const $ = cheerio.load(html);

    const notasArray = [];
    let notasObj = {};

    let isAvailable = false;

    $('font td font').text((index, text) => {
      if (index % 7 === 0) {
        notasObj.codigo = text.trim();
        return;
      }

      if ((index - 1) % 7 === 0) {
        notasObj.nome = parseSubjectName(text.trim(), true);
        return;
      }
      const number = parseNumber(text);

      if ((index - 2) % 7 === 0) {
        notasObj.turma = number;
      }
      if ((index - 3) % 7 === 0) {
        notasObj.p1 = number;
        !isAvailable && (isAvailable = number !== undefined);
      }
      if ((index - 4) % 7 === 0) {
        notasObj.p2 = number;
        !isAvailable && (isAvailable = number !== undefined);
      }
      if ((index - 5) % 7 === 0) {
        notasObj.pf = number;
        !isAvailable && (isAvailable = number !== undefined);
      }
      if ((index - 6) % 7 === 0) {
        notasObj.media = number;
        !isAvailable && (isAvailable = number !== undefined);
        notasArray.push(notasObj);
        notasObj = {};
      }
    });

    return {notasArray, isAvailable};
  } catch (err) {
    throw new Error('ParseError');
  }
}
