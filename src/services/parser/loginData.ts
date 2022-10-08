const cheerio = require('react-native-cheerio');

export default function parseLoginInfo(data: string) {
  const info = {
    periodo: '',
    nome: '',
    fail_reason: '',
  };

  const $ = cheerio.load(data);
  $('font').text((index: number, text: string) => {
    if (index === 1) {
      info.periodo = text.replace(/\s/g, '').replace('/', '.');
    }
    if (index === 2) {
      info.nome = text.split(' - ')[1];
    }
  });

  $('br+ table font').text((index: number, text: string) => {
    if (index === 0) {
      info.fail_reason = text.trim();
    }
  });

  return info;
}
