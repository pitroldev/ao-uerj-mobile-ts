import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { Message, Teacher } from '@root/modules/community/domain/models';
import type {
  MessageBoardPort,
  TeacherDirectoryPort,
  RequestOptions,
} from '@root/modules/community/application/ports';
import type { ErrorReporterPort } from '@root/modules/support/application/ports';

export interface PrivateApiHttpClient {
  get(url: string, options?: RequestOptions): Promise<{ data: unknown }>;
  post(
    url: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<{ data: unknown }>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError('SERVICE_UNAVAILABLE');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('SERVICE_UNAVAILABLE');
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new AppError('SERVICE_UNAVAILABLE');
  return value;
}
function identifier(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value);
}
function date(value: unknown): string {
  const parsed = text(value);
  if (Number.isNaN(Date.parse(parsed)))
    throw new AppError('SERVICE_UNAVAILABLE');
  return parsed;
}
function message(value: unknown): Message {
  const data = object(value);
  return {
    id: text(data._id),
    authorName: text(data.fullName),
    subjectId: text(data.disciplina),
    period: text(data.periodo),
    classNumber: identifier(data.turma),
    text: text(data.message),
    createdAt: date(data.createdAt),
  };
}
function teacher(value: unknown): Teacher {
  const data = object(value);
  return {
    id: text(data._id),
    name: text(data.docente),
    updatedAt: date(data.createdAt),
    subjects: Object.entries(object(data.disciplinas)).map(([id, raw]) => {
      const subject = object(raw);
      return {
        id,
        name: text(subject.disciplina),
        classes: list(subject.turmas).map(rawClass => {
          const item = object(rawClass);
          return {
            number: identifier(item.turma),
            location: item.local == null ? '' : text(item.local),
          };
        }),
      };
    }),
  };
}

async function request<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (axios.isCancel(error)) throw new AppError('CANCELLED');
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) throw new AppError('RATE_LIMITED');
      if (
        error.response?.status === 400 &&
        error.response.data?.error === 'invalid_request'
      )
        throw new AppError('INVALID_INPUT');
      if (error.response) throw new AppError('SERVICE_UNAVAILABLE');
      throw new AppError('NETWORK');
    }
    throw new AppError('SERVICE_UNAVAILABLE');
  }
}

export function createPrivateApiAdapters(
  client: PrivateApiHttpClient = axios.create({
    baseURL: 'https://pitrol.dev/aouerj',
    timeout: 15000,
    withCredentials: false,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }),
): {
  messageBoard: MessageBoardPort;
  teacherDirectory: TeacherDirectoryPort;
  errorReporter: ErrorReporterPort;
} {
  return {
    messageBoard: {
      read: (thread, options) =>
        request(async () => {
          const { data } = await client.post(
            '/messages/get',
            {
              disciplina: thread.subjectId,
              turma: thread.classNumber,
              periodo: thread.period,
            },
            options,
          );
          return list(data).map(message);
        }),
      post: (input, options) =>
        request(async () => {
          const { data } = await client.post(
            '/messages/post',
            {
              fullName: input.authorName,
              disciplina: input.subjectId,
              turma: input.classNumber,
              periodo: input.period,
              message: input.text,
            },
            options,
          );
          return message(data);
        }),
    },
    teacherDirectory: {
      list: options =>
        request(async () => {
          const { data } = await client.get('/docentes', options);
          return list(object(data).docentes).map(text);
        }),
      find: (name, options) =>
        request(async () => {
          const { data } = await client.get(
            `/docentes/${encodeURIComponent(name)}`,
            options,
          );
          const found = list(object(data).docentes);
          return found.length === 0 ? null : teacher(found[0]);
        }),
    },
    errorReporter: {
      submit: report =>
        request(async () => {
          // Retain the server's existing envelope; this field contains only an
          // allowlisted diagnostic object, never a portal HTML response.
          await client.post('/reportError', {
            page: report.page,
            description: report.description,
            html: [JSON.stringify(report.diagnostic)],
          });
        }),
    },
  };
}
