import type { MessageThread } from '../domain/models';

export const communityKeys = {
  messages: (scope: string, thread: MessageThread) =>
    [
      'community',
      scope,
      'messages',
      thread.period,
      thread.subjectId,
      thread.classNumber,
    ] as const,
  teachers: (scope: string) => ['community', scope, 'teachers'] as const,
  teacher: (scope: string, name: string) =>
    ['community', scope, 'teacher', name] as const,
};
