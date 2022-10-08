const cheerio = require('react-native-cheerio');

export default async function parseSubjectInfoReqId(data: string) {
  let reqLibrary = {
    HorariosTurmasDisciplina: '',
    DadosDisciplina: '',
  };
  if (!data) {
    throw new Error('SUBJECT_REQ_ID_NOT_FOUND');
  }

  const regex = /\w{20,}/gi;

  const $ = cheerio.load(data);
  $('td:nth-child(3) a')
    .eq(0)
    .each((index: number, node: any) => {
      const cleanedReqID = node.attribs.onclick.replace(/[\s']+/gi, '');
      const execReqID = cleanedReqID.match(regex);
      const parsedReqID = execReqID.length && execReqID[0];
      reqLibrary.HorariosTurmasDisciplina = parsedReqID;
    });

  $('.LINKNAOSUB')
    .eq(0)
    .each((index: number, node: any) => {
      const cleanedReqID = node.attribs.onclick.replace(/[\s']+/gi, '');
      const execReqID = cleanedReqID.match(regex);
      const parsedReqID = execReqID.length && execReqID[0];
      reqLibrary.DadosDisciplina = parsedReqID;
    });

  return reqLibrary;
}
