/** O mural: conversas por turma, num período, abertas a quem cursa. */

/** A conversa de uma turma. */
export type MessageThread = {
  /** Código da disciplina ("IME02-10892"). */
  subjectId: string;
  /** "2026.1". */
  period: string;
  classNumber: string;
};

export type NewMessage = {
  thread: MessageThread;
  /** O nome que o aluno escolheu mostrar. */
  authorName: string;
  text: string;
  /** O aluno que escreveu (v2, com a sessão); a rota antiga não sabe. */
  studentId?: string | null;
};

export type Message = NewMessage & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Tamanhos máximos, os mesmos no HTTP e no banco. O servidor antigo não
 * conferia nada (só o corpo de 100 KB), e os apps 1.x não limitam o texto:
 * os limites ficam bem acima do que um aluno escreve. O app atual corta a
 * mensagem em 2000; o nome é o do portal, sem corte.
 */
export const MESSAGE_LIMITS = {
  subjectId: 100,
  period: 30,
  classNumber: 30,
  authorName: 200,
  text: 10000,
} as const;

/**
 * Uma conversa traz as mensagens mais recentes, no máximo estas, da mais
 * antiga para a mais nova: o app as mostra na ordem recebida.
 */
export const THREAD_PAGE = 500;
