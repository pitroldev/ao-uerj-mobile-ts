const cheerio = require('react-native-cheerio');

export function isSessionExpiredResponse(data: unknown): boolean {
  if (typeof data !== 'string') {
    return data === undefined || data === null;
  }

  if (!data.trim()) {
    return true;
  }

  const $ = cheerio.load(data);
  const hasLoginForm =
    $('input[name="matricula"]').length > 0 &&
    $('input[name="senha"]').length > 0;

  // With no valid cookie the portal returns this error page with HTTP 200.
  // Its normal authenticated pages also use HTTP 200, so status/size alone
  // cannot distinguish an expired session from academic data.
  const isPortalSessionError =
    $('#divCabecalhoAplicacao').length === 0 &&
    /aluno\s+online/i.test($('.topo').text()) &&
    /página\s+não\s+encontrada/i.test($('.conteudo').text());

  return hasLoginForm || isPortalSessionError;
}
