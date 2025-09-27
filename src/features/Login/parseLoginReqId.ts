const cheerio = require('react-native-cheerio');

export default async function parseLoginReqId(data: string) {
  let loginReqId = '';
  let _token = '';

  if (!data) {
    throw new Error('LOGIN_REQ_ID_NOT_FOUND');
  }

  const $ = cheerio.load(data);
  $('input[name="requisicao"]')
    .eq(0)
    .each((index: string, node: any) => {
      const { value } = node.attribs;
      loginReqId = value;
    });

  $('input[name="_token"]')
    .eq(0)
    .each((index: string, node: any) => {
      const { value } = node.attribs;
      _token = value;
    });

  return { loginReqId, _token };
}
