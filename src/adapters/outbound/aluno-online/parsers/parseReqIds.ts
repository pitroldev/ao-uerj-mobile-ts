import type { CheerioAPI } from '../html';

type ReqIds = {
  dictionary: {
    [key: string]: string;
  };
  failed: number;
};

function translate(name: string) {
  const lowerName = name.toLowerCase();
  const dictionary = {
    'turmas em curso': 'DisciplinasCurso',
    'disciplinas do curso': 'DisciplinasCursar',
    'disciplinas do currículo': 'DisciplinasCursar',
    'disciplinas do currículo/a cursar': 'DisciplinasCursar',
    'disciplinas universais': 'UniversaisCursar',
    'disciplinas universais (a cursar)': 'UniversaisCursar',
    'requisitos realizados': 'DisciplinasRealizadas',
    'requisitos cursados': 'DisciplinasRealizadas',
    'disciplinas realizadas': 'DisciplinasRealizadas',
    'notas do período': 'notas',
    'rid: resultado provisório': 'RidParcial',
    'rid: resultado da inscrição': 'RidInscricao',
    'síntese da formação': 'SinteseFormacao',
  } as ReqIds['dictionary'];

  return dictionary[lowerName] || name;
}

export function getReqIds($: CheerioAPI): ReqIds {
  const regex = /\w{20,}/gi;

  const dictionary: ReqIds['dictionary'] = {};
  let failed = 0;

  $('#menu_linha_item a').each((_index, node) => {
    const cleanedReqID = (node.attribs.onclick ?? '').replace(/[\s']+/gi, '');
    const execReqID = cleanedReqID.match(regex);

    const isBlocked = !execReqID;
    if (isBlocked) {
      failed += 1;
      return;
    }

    const [parsedReqID] = execReqID;
    const reqName = $(node).text().trim();
    if (reqName) {
      dictionary[translate(reqName)] = parsedReqID;
    }
  });

  return { dictionary, failed };
}
