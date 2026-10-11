import { AppError } from '@root/shared/errors/AppError';
import type {
  MessageBoardPort,
  RequestOptions,
  TeacherDirectoryPort,
} from './ports';
import { MAX_MESSAGE_LENGTH, type MessageThread } from '../domain/models';

type CommunityAccount = { scope: string; name: string };
type Dependencies = {
  messageBoard: MessageBoardPort;
  teacherDirectory: TeacherDirectoryPort;
  currentAccount: () => CommunityAccount | null;
};

function normalizeThread(thread: MessageThread): MessageThread {
  const normalized = {
    subjectId: thread.subjectId.trim(),
    classNumber: thread.classNumber.trim(),
    period: thread.period.trim(),
  };
  if (
    !normalized.subjectId ||
    normalized.subjectId.length > 100 ||
    !normalized.classNumber ||
    normalized.classNumber.length > 30 ||
    !/^\d{4}\.[12]$/.test(normalized.period)
  )
    throw new AppError('INVALID_INPUT');
  return normalized;
}

export class Community {
  constructor(private readonly dependencies: Dependencies) {}

  private async forAccount<T>(
    operation: (account: CommunityAccount) => Promise<T>,
  ): Promise<T> {
    const account = this.dependencies.currentAccount();
    if (!account) throw new AppError('NOT_LOGGED_IN');
    const result = await operation(account);
    if (this.dependencies.currentAccount()?.scope !== account.scope)
      throw new AppError('CANCELLED');
    return result;
  }

  messages = async (thread: MessageThread, options?: RequestOptions) => {
    const normalized = normalizeThread(thread);
    return this.forAccount(() =>
      this.dependencies.messageBoard.read(normalized, options),
    );
  };

  postMessage = async (
    thread: MessageThread,
    text: string,
    options?: RequestOptions,
  ) => {
    const normalized = normalizeThread(thread);
    const message = text.trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH)
      throw new AppError('INVALID_INPUT');
    return this.forAccount(account =>
      this.dependencies.messageBoard.post(
        {
          ...normalized,
          authorName: account.name,
          text: message,
        },
        options,
      ),
    );
  };

  teachers = (options?: RequestOptions) =>
    this.forAccount(() => this.dependencies.teacherDirectory.list(options));
  teacher = (name: string, options?: RequestOptions) =>
    this.forAccount(() =>
      this.dependencies.teacherDirectory.find(name, options),
    );
}
