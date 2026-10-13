/**
 * DSN do projeto no Sentry. Vazio desliga o envio de erros (o SDK nem é
 * inicializado), e o app funciona normalmente.
 *
 * Para ativar: crie a organização na região UE (https://de.sentry.io, com
 * "Data Storage Location: European Union"), crie um projeto React Native e
 * cole aqui o DSN de "Settings > Projects > Client Keys". O DSN não é segredo
 * (vai dentro do app), mas só aceita eventos: o token de envio de source maps
 * (SENTRY_AUTH_TOKEN) nunca entra no repositório. Veja "Persistência e
 * privacidade" no README.
 */
export const SENTRY_DSN = '';
