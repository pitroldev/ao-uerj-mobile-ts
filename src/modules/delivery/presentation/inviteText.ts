import { inviteLink, type InviteSource } from '../domain/invite';

/**
 * Um convite: o texto que o aluno manda (na voz dele, editável no app de
 * destino) e a origem, que vai no link.
 */
export type Invite = { source: InviteSource; text: string };

const APP =
  'Tô usando o AO UERJ: grade, notas, quanto falta na PF e aviso de nota nova, tudo no celular. É grátis, para Android:';

/** Do menu e do Sobre: o app inteiro. */
export const appInvite = (source: 'menu' | 'sobre'): Invite => ({
  source,
  text: APP,
});

/** Da conversa de uma turma no mural, ainda vazia. */
export function muralInvite(
  subject: string,
  classNumber: string | number | null | undefined,
): Invite {
  const turma =
    classNumber === null || classNumber === undefined || classNumber === ''
      ? ''
      : ` (turma ${classNumber})`;
  return {
    source: 'mural',
    text: `Abri o mural de ${subject}${turma} no AO UERJ. Entra lá pra gente trocar material, links e datas de prova:`,
  };
}

/** Do Agora no campus sem avisos. */
export const CAMPUS_INVITE: Invite = {
  source: 'campus',
  text: 'No AO UERJ, quem está no campus avisa fila do bandejão, elevador parado e Wi-Fi fora. Quanto mais gente, mais avisos. É grátis, para Android:',
};

/** Da Companhia agora sem mesas nem grupos. */
export const COMPANION_INVITE: Invite = {
  source: 'companhia',
  text: 'No AO UERJ dá pra abrir uma mesa no almoço ou um grupo pra voltar depois da aula, com gente da UERJ. É grátis, para Android:',
};

/** A mensagem inteira, com o link no fim. */
export const inviteMessage = (invite: Invite): string =>
  `${invite.text} ${inviteLink(invite.source)}`;

/** A legenda que vai junto com a imagem da grade. */
export const scheduleCaption = (period?: string | null): string =>
  `Minha grade${period ? ` de ${period}` : ''}, feita no app AO UERJ: ${inviteLink('grade')}`;
