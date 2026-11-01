import { THREAD_PAGE } from './domain.ts';
import type { MessageRepository, Mural } from './ports.ts';

export function createMural(messages: MessageRepository): Mural {
  return {
    listThread: thread => messages.listThread(thread, THREAD_PAGE),
    post: message => messages.create(message),
  };
}
