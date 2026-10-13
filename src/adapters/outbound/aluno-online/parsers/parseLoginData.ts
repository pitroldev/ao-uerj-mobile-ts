import type { CheerioAPI } from '../html';

const PERIODO_REGEX = /(\d{4}\.\d)/;

function normalize(message: string) {
  return message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * The portal answers an unknown registration, an account without Aluno Online
 * access and a maintenance window with one combined warning ("a matrícula
 * informada não existe, ou não está habilitada…, ou existe alguma
 * manutenção…"). It may be temporary, so it must never erase a saved
 * credential.
 */
export function reportsUnavailableAccount(message: string): boolean {
  return /matricula.*nao existe|nao esta habilitad|manutencao/.test(
    normalize(message),
  );
}

/** Session/CSRF pages and portal warnings are not evidence of a bad password. */
export function rejectsCredentials(message: string): boolean {
  if (reportsUnavailableAccount(message)) return false;
  return /(matricula|senha).*(invalid|incorret|nao confer|nao correspond|inexisten)/.test(
    normalize(message),
  );
}

export function parseLoginInfo($: CheerioAPI) {
  const info = {
    periodo: '',
    nome: '',
    fail_reason: '',
  };

  $('#divCabecalhoAplicacao font').each((index, node) => {
    const text = $(node).text();
    if (index === 0) {
      info.nome = text.split(' - ').slice(1).join(' - ').trim();
    }
    if (index === 1) {
      const possiblePeriodText = text.replace(/\s/g, '').replace('/', '.');
      const isPeriod = PERIODO_REGEX.test(possiblePeriodText);
      info.periodo = isPeriod
        ? (possiblePeriodText.match(PERIODO_REGEX)?.[0] ?? '')
        : '';
    }
  });

  $('br+ table font').each((index, node) => {
    if (index === 0) {
      info.fail_reason = $(node).text().trim();
    }
  });

  return info;
}
