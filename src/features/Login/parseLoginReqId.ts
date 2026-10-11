const cheerio = require('react-native-cheerio');

export default async function parseLoginReqId(data: string) {
  if (!data) {
    throw new Error('LOGIN_REQ_ID_NOT_FOUND');
  }

  const $ = cheerio.load(data);
  const loginReqId = $('input[name="requisicao"]')
    .first()
    .attr('value')
    ?.trim();
  const _token = $('input[name="_token"]').first().attr('value')?.trim();

  if (!loginReqId) {
    throw new Error('LOGIN_REQ_ID_NOT_FOUND');
  }

  if (!_token) {
    throw new Error('LOGIN_TOKEN_NOT_FOUND');
  }

  return { loginReqId, _token };
}
