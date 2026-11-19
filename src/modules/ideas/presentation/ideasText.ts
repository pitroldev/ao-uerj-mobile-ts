import type { IconName } from '@components/ui/Icon/glyphs';
import type { UiTone } from '@components/ui/tones';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import {
  IdeaError,
  IDEA_LIMITS,
  type ContactKind,
  type FieldProblem,
  type IdeaArea,
  type IdeaField,
  type IdeaStatus,
  type MyIdea,
  type PortalAnswer,
} from '../domain/ideas';

/*
 * As palavras de "Sugerir uma ideia", como um aluno falaria: "ideia",
 * "pedido", "feita". Nada de "issue" na tela (o GitHub aparece pelo nome).
 */

/** As áreas com os nomes do app (as mesmas etiquetas "área: …" do GitHub). */
export const AREA_TEXT: Readonly<Record<IdeaArea, string>> = {
  home: 'Início',
  schedule: 'Grade',
  grades: 'Notas',
  rid: 'RID',
  subjects: 'Disciplinas',
  generator: 'Gerador de grade',
  companion: 'Companhia agora',
  campus: 'Agora no campus',
  map: 'Mapa',
  mural: 'Mural',
  other: 'Outro',
};

/** A opção curta do seletor e o texto que vai no issue. */
export const PORTAL_TEXT: Readonly<
  Record<PortalAnswer, { option: string; full: string }>
> = {
  yes_bad: {
    option: 'Sim, mas é ruim',
    full: 'Sim, mas é ruim de usar no celular',
  },
  no: { option: 'Não', full: 'Não' },
  unknown: { option: 'Não sei', full: 'Não sei' },
};

export const STATUS_TEXT: Readonly<
  Record<IdeaStatus, { label: string; tone: UiTone; icon: IconName }>
> = {
  received: { label: 'Recebida', tone: 'neutral', icon: 'schedule' },
  not_published: { label: 'Não publicada', tone: 'neutral', icon: 'block' },
  open: { label: 'No GitHub', tone: 'info', icon: 'public' },
  planned: { label: 'Planejada', tone: 'warn', icon: 'event_upcoming' },
  in_progress: { label: 'Em andamento', tone: 'warn', icon: 'sync' },
  done: { label: 'Feita', tone: 'good', icon: 'check_circle' },
  closed: { label: 'Fechada', tone: 'neutral', icon: 'cancel' },
};

/** As seções do issue, como o servidor escreve (a prévia mostra o que vai sair). */
export const ISSUE_SECTIONS = {
  problem: 'Qual problema isso resolve?',
  idea: 'Como você imagina?',
  portal: 'O Aluno Online já faz isso?',
  area: 'Onde no app',
} as const;

/** "[Sugestão] …": o título do issue. */
export const issueTitle = (title: string) => `[Sugestão] ${title}`;

export const requestsText = (requests: number) =>
  requests === 1 ? '1 pedido' : `${requests} pedidos`;

/** A linha de baixo de uma sugestão na lista: o que dá para dizer do estado. */
export function ideaMeta(idea: Pick<MyIdea, 'status' | 'issue' | 'requests'>) {
  if (idea.status === 'received')
    return 'Vai para o GitHub depois de uma olhada';
  if (!idea.issue) return null;
  return `#${idea.issue.number} · ${requestsText(idea.requests)}`;
}

/** O texto completo de uma linha, para o leitor de tela. */
export function ideaLabel(idea: MyIdea): string {
  const meta = ideaMeta(idea);
  return [
    idea.title,
    idea.kind === 'joined' ? 'Pedido somado' : null,
    STATUS_TEXT[idea.status].label,
    meta,
  ]
    .filter(Boolean)
    .join('. ');
}

/** "1 feita", "2 feitas". */
export const doneText = (count: number) =>
  count === 1 ? '1 feita' : `${count} feitas`;

const CONTACT_TEXT: Readonly<Record<ContactKind, string>> = {
  email: 'Tire o e-mail: a sugestão fica pública.',
  at: 'Tire o @: a sugestão fica pública.',
  link: 'Tire o link: a sugestão fica pública.',
  phone: 'Tire o telefone: a sugestão fica pública.',
  app: 'Tire o nome do app de conversa: a sugestão fica pública.',
};

/** O que o servidor recusou sem dizer qual contato. */
export const SERVER_CONTACT_TEXT =
  'Tire telefone, e-mail, @ ou link: a sugestão fica pública.';

const FIELD_NAME: Readonly<Record<IdeaField, string>> = {
  title: 'do título',
  problem: 'do problema',
  idea: 'de "Como você imagina"',
};

const SHORT_TEXT: Readonly<Record<IdeaField | 'area', string>> = {
  title: 'Escreva a ideia em uma frase.',
  problem: 'Conte o problema em uma ou duas frases.',
  // "Como você imagina" é opcional: nunca curto demais
  idea: 'Conte como você imagina.',
  area: 'Escolha onde no app.',
};

/** 80 → "80"; 1000 → "1.000". */
const thousands = (value: number) =>
  value < 1000
    ? String(value)
    : `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, '0')}`;

/** O erro de um campo da folha. */
export function fieldErrorText(
  field: IdeaField | 'area',
  problem: FieldProblem,
): string {
  if (problem === 'short') return SHORT_TEXT[field];
  if (problem === 'long')
    return `Até ${thousands(field === 'title' ? IDEA_LIMITS.title.max : IDEA_LIMITS.problem.max)} letras.`;
  return CONTACT_TEXT[problem];
}

export const LIMIT_TEXT = `Você já mandou ${IDEA_LIMITS.perDay} hoje. Amanhã dá para mandar mais.`;

/** O que a recusa ou o erro quer dizer, para o snackbar. */
export function ideasErrorMessage(error: unknown): string {
  if (error instanceof IdeaError) {
    switch (error.refusal) {
      case 'contact':
        return error.field
          ? `Tire telefone, e-mail, @ ou link ${FIELD_NAME[error.field]}: a sugestão fica pública.`
          : SERVER_CONTACT_TEXT;
      case 'limit':
        return LIMIT_TEXT;
      case 'gone':
        return 'Essa sugestão já fechou no GitHub. Se a sua é outra, mande a sua.';
      case 'github':
        return 'O GitHub não respondeu agora. Tente de novo daqui a pouco.';
    }
  }
  if (error instanceof AppError && error.code === 'STUDENT_PROOF_UNAVAILABLE')
    return 'Não deu para confirmar que você é aluno agora. Com a internet ligada, tente de novo em alguns segundos.';
  return errorMessage(error);
}
