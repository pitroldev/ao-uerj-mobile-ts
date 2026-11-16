import type { CheerioAPI } from '../html';

type ReqIds = {
  dictionary: {
    [key: string]: string;
  };
  /**
   * Itens que o portal lista sem requisição: `executaMenu(1, '', …)`, que no
   * site só mostra "Acesso temporariamente bloqueado.". Na época de inscrição
   * quase todo o menu vem assim, com o login funcionando.
   */
  blocked: string[];
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
  const blocked: string[] = [];

  $('#menu_linha_item a').each((_index, node) => {
    const cleanedReqID = (node.attribs.onclick ?? '').replace(/[\s']+/gi, '');
    const execReqID = cleanedReqID.match(regex);
    const reqName = $(node).text().trim();
    if (!reqName) return;

    if (!execReqID) {
      blocked.push(translate(reqName));
      return;
    }

    const [parsedReqID] = execReqID;
    dictionary[translate(reqName)] = parsedReqID;
  });

  return { dictionary, blocked };
}
