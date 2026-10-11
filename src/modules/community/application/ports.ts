import type {
  Message,
  MessageThread,
  NewMessage,
  Teacher,
} from '../domain/models';

export type RequestOptions = { signal?: AbortSignal };

export interface MessageBoardPort {
  read(thread: MessageThread, options?: RequestOptions): Promise<Message[]>;
  post(message: NewMessage, options?: RequestOptions): Promise<Message>;
}

export interface TeacherDirectoryPort {
  list(options?: RequestOptions): Promise<string[]>;
  find(name: string, options?: RequestOptions): Promise<Teacher | null>;
}
