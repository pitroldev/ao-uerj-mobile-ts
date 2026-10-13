import type { CheerioAPI } from '../html';

export function parseSubjectInfoReqId($: CheerioAPI): string {
  const regex = /\w{20,}/gi;

  let reqId: string = '';

  $('input[name="requisicao"]').each((_index, node) => {
    const cleanedReqID = node.attribs.value.replace(/[\s']+/gi, '');
    const execReqID = cleanedReqID.match(regex);

    const isBlocked = !execReqID;
    if (isBlocked) {
      return;
    }

    const [parsedReqID] = execReqID;
    reqId = parsedReqID;
  });

  return reqId;
}
