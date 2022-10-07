const cheerio = require('react-native-cheerio');

export default async function parseLoginReqId(data: string) {
  let reqID = '';
  if (!data) {
    throw new Error('LOGIN_REQ_ID_NOT_FOUND');
  }
  const $ = cheerio.load(data);
  $('input[name ="requisicao"]')
    .eq(0)
    .each((index: string, node) => {
      const {value} = node.attribs;
      reqID = value;
    });

  return reqID;
}
