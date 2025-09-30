const cheerio = require('react-native-cheerio');

const PERIODO_REGEX = /(\d{4}\.\d)/;

const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;
const semester = month > 1 && month <= 7 ? '1' : '2';
const calculatedPeriod = `${year}.${semester}`;

export default function parseLoginInfo(data: string) {
  const info = {
    periodo: '',
    nome: '',
    fail_reason: '',
  };

  const $ = cheerio.load(data);
  $('#divCabecalhoAplicacao font').text((index: number, text: string) => {
    if (index === 0) {
      info.nome = text.split(' - ')[1];
    }
    if (index === 1) {
      const possiblePeriodText = text.replace(/\s/g, '').replace('/', '.');
      const isPeriod = PERIODO_REGEX.test(possiblePeriodText);
      info.periodo = isPeriod ? possiblePeriodText : calculatedPeriod;
    }
  });

  $('br+ table font').text((index: number, text: string) => {
    if (index === 0) {
      info.fail_reason = text.trim();
    }
  });

  return info;
}
