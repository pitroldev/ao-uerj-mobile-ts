const cheerio = require('react-native-cheerio');
import {parseSubjectName, parseSubjectID} from './minorParser';

export default function ridProvisorio(html) {
  try {
    const $ = cheerio.load(html);

    const disciplinasArray = [];
    let disciplinasObj = {};

    if (!$('div div td').text()) {
      throw new Error('Unavailable');
    }

    $('div div td').text((index, text) => {
      if (index % 6 === 0) {
        disciplinasObj.codigo = parseSubjectID(text);
        disciplinasObj.disciplina = parseSubjectName(text);
      }

      if ((index - 1) % 6 === 0) {
        disciplinasObj.turma = text.trim();
      }
      if ((index - 2) % 6 === 0) {
        disciplinasObj.oferecidas = text.trim();
      }
      if ((index - 3) % 6 === 0) {
        disciplinasObj.solicitadas = text.trim();
      }
      if ((index - 4) % 6 === 0) {
        disciplinasObj.posicao = text.trim();
      }
      if ((index - 5) % 6 === 0) {
        disciplinasObj.situacao = text.trim();
        disciplinasArray.push(disciplinasObj);
        disciplinasObj = {};
      }
    });

    const currentRIDDate = $('div div:nth-child(1) b').text();

    const parsedDate = `Última atualização em ${currentRIDDate
      .trim()
      .replace(' ', ', às ')}.`;

    const ridData = {
      data: disciplinasArray,
      date: parsedDate,
    };

    return ridData;
  } catch (err) {
    throw new Error(`ParseError ${err.message}`);
  }
}
