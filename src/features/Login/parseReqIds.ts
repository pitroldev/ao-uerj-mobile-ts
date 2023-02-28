const cheerio = require('react-native-cheerio');

type ReqIds = {
  dictionary: {
    [key: string]: string;
  };
  failed: number;
};

function translate(name: string) {
  const lowerName = name.toLowerCase();
  const dictionary = {
    'disciplinas do curso': 'DisciplinasFormacao',
    'disciplinas universais (a cursar)': 'UniversaisCursar',
    'turmas em curso': 'DisciplinasCurso',
    'disciplinas a cursar': 'DisciplinasCursar',
    'disciplinas realizadas': 'DisciplinasRealizadas',
    'notas do período': 'notas',
    'rid: resultado provisório': 'RidParcial',
  } as ReqIds['dictionary'];

  return dictionary[lowerName] || name;
}

export function getReqIds(data: string): ReqIds {
  const regex = /\w{20,}/gi;

  const dictionary: ReqIds['dictionary'] = {};
  let failed = 0;

  const $ = cheerio.load(data);
  $('#menu_linha_item a').each((i: Number, node: any) => {
    const cleanedReqID = node.attribs.onclick.replace(/[\s']+/gi, '');
    const execReqID = cleanedReqID.match(regex);

    const isBlocked = !execReqID;
    if (isBlocked) {
      failed += 1;
      return;
    }

    const parsedReqID = execReqID.length && execReqID[0];
    let reqName = '';
    $(node).text((j: Number, t: string) => (reqName = t.trim()));
    if (reqName) {
      dictionary[translate(reqName)] = parsedReqID;
    }
  });

  return {dictionary, failed};
}
