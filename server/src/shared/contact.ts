/**
 * Telefone, @, link ou o nome de um aplicativo de conversa: o que um texto
 * público (o recado da Companhia agora, a sugestão que vira issue) não pode
 * levar. Oito algarismos seguidos (com espaço, ponto, traço ou parêntese no
 * meio) já são um telefone; um horário não.
 */
const CONTACT =
  /(?:\d[\s().-]*){8,}|@|https?:|www\.|\.(?:com|br|me)\b|whats|wpp|\bzap\b|insta|telegram|t\.me|discord|tiktok/i;

export const hasContact = (text: string) => CONTACT.test(text);
