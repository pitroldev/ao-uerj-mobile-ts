import parseLoginReqId from '../parsers/parseLoginReqId';
import { loginPage } from '../__fixtures__/loginPages';

describe('parseLoginReqId', () => {
  it('extracts the requisition and CSRF token from the login form', async () => {
    await expect(parseLoginReqId(loginPage)).resolves.toEqual({
      loginReqId: 'synthetic-login-requisition',
      _token: 'synthetic-csrf-token',
    });
  });

  it.each([
    '',
    '<html><body>Página não encontrada!</body></html>',
    '<form><input name="_token" value="token"></form>',
    '<form><input name="requisicao"><input name="_token" value="token"></form>',
    '<form><input name="requisicao" value="   "><input name="_token" value="token"></form>',
  ])('rejects a page without a login requisition: %s', async html => {
    await expect(parseLoginReqId(html)).rejects.toThrow(
      'LOGIN_REQ_ID_NOT_FOUND',
    );
  });

  it.each([
    '<form><input name="requisicao" value="req"></form>',
    '<form><input name="requisicao" value="req"><input name="_token"></form>',
    '<form><input name="requisicao" value="req"><input name="_token" value="   "></form>',
  ])('rejects a page without a CSRF token: %s', async html => {
    await expect(parseLoginReqId(html)).rejects.toThrow(
      'LOGIN_TOKEN_NOT_FOUND',
    );
  });
});
