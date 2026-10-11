const cheerio = require('react-native-cheerio');

const PERIODO_REGEX = /(\d{4}\.\d)/;

/** Session/CSRF pages and portal warnings are not evidence of a bad password. */
export function rejectsCredentials(message: string): boolean {
  const text = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /(matricula|senha).*(invalid|incorret|nao confer|nao correspond|inexisten)/.test(
    text,
  );
}

export default function parseLoginInfo(data: string) {
  const info = {
    periodo: '',
    nome: '',
    fail_reason: '',
  };

  const $ = cheerio.load(data);
  $('#divCabecalhoAplicacao font').text((index: number, text: string) => {
    if (index === 0) {
      info.nome = text.split(' - ').slice(1).join(' - ').trim();
    }
    if (index === 1) {
      const possiblePeriodText = text.replace(/\s/g, '').replace('/', '.');
      const isPeriod = PERIODO_REGEX.test(possiblePeriodText);
      info.periodo = isPeriod
        ? possiblePeriodText.match(PERIODO_REGEX)?.[0] ?? ''
        : '';
    }
  });

  $('br+ table font').text((index: number, text: string) => {
    if (index === 0) {
      info.fail_reason = text.trim();
    }
  });

  return info;
}
