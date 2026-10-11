const cheerio = require('react-native-cheerio');

export default function parseSubjectInfoReqId(data: string): string {
  if (!data) {
    throw new Error('SUBJECT_REQ_ID_NOT_FOUND');
  }

  const regex = /\w{20,}/gi;

  let reqId: string = '';

  const $ = cheerio.load(data);
  $('input[name="requisicao"]').each((_: number, node: any) => {
    const cleanedReqID = node.attribs.value.replace(/[\s']+/gi, '');
    const execReqID = cleanedReqID.match(regex);

    const isBlocked = !execReqID;
    if (isBlocked) {
      return;
    }

    const parsedReqID = execReqID.length && execReqID[0];
    reqId = parsedReqID;
  });

  return reqId;
}
