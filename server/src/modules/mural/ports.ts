import type { Message, MessageThread, NewMessage } from './domain.ts';

/** Porta de entrada: o que o mural oferece. */
export interface Mural {
  /** A página mais recente da conversa, da mais antiga para a mais nova. */
  listThread(thread: MessageThread): Promise<Message[]>;
  post(message: NewMessage): Promise<Message>;
}

/** Porta de saída: onde as mensagens ficam. */
export interface MessageRepository {
  /** As `limit` mais recentes da conversa, da mais antiga para a mais nova. */
  listThread(thread: MessageThread, limit: number): Promise<Message[]>;
  create(message: NewMessage): Promise<Message>;
}
