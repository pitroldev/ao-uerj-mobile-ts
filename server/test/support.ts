import { pino } from 'pino';

import { loadConfig, type Config } from '../src/config.ts';
import type { Overrides } from '../src/composition.ts';
import type { Message } from '../src/modules/mural/domain.ts';
import type { MessageRepository } from '../src/modules/mural/ports.ts';
import type { ErrorReport } from '../src/modules/reports/domain.ts';
import type {
  AttachmentStore,
  ErrorReportRepository,
} from '../src/modules/reports/ports.ts';
import type { Suggestion } from '../src/modules/suggestions/domain.ts';
import type { SuggestionRepository } from '../src/modules/suggestions/ports.ts';
import type { Teacher } from '../src/modules/teachers/domain.ts';
import type { TeacherRepository } from '../src/modules/teachers/ports.ts';

export const silentLogger = pino({ level: 'silent' });

/** A configuração dos testes: o ambiente mínimo mais o que o teste pedir. */
export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ NODE_ENV: 'test', ...env });
}

/** Um relógio que só anda quando o teste manda. */
export function manualClock(start = Date.UTC(2026, 9, 22, 12)) {
  let time = start;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
}

/** Um banco em memória para os casos de uso e o HTTP. */
export function memoryRepositories(clock = manualClock()) {
  let sequence = 0;
  const id = () => `id-${++sequence}`;
  const stamp = () => {
    clock.advance(1000);
    return new Date(clock.now());
  };
  const messages: Message[] = [];
  const teachers: Teacher[] = [];
  const reports: ErrorReport[] = [];
  const suggestions: Suggestion[] = [];

  const messageRepository: MessageRepository = {
    async listThread(thread, limit) {
      return messages
        .filter(
          message =>
            message.thread.subjectId === thread.subjectId &&
            message.thread.period === thread.period &&
            message.thread.classNumber === thread.classNumber,
        )
        .slice(-limit);
    },
    async create(message) {
      const at = stamp();
      const created = { ...message, id: id(), createdAt: at, updatedAt: at };
      messages.push(created);
      return created;
    },
  };

  const teacherRepository: TeacherRepository = {
    async listNames() {
      return teachers.map(teacher => teacher.name);
    },
    async searchByName(fragment, limit) {
      const lower = fragment.toLowerCase();
      return teachers
        .filter(teacher => teacher.name.toLowerCase().includes(lower))
        .slice(0, limit);
    },
  };

  const reportRepository: ErrorReportRepository = {
    async create(report) {
      const at = stamp();
      const created = { ...report, id: id(), createdAt: at, updatedAt: at };
      reports.push(created);
      return created;
    },
    async listRecent(limit) {
      return [...reports].reverse().slice(0, limit);
    },
  };

  const suggestionRepository: SuggestionRepository = {
    async create(suggestion) {
      const at = stamp();
      const created = { ...suggestion, id: id(), createdAt: at, updatedAt: at };
      suggestions.push(created);
      return created;
    },
    async listRecent(limit) {
      return [...suggestions].reverse().slice(0, limit);
    },
  };

  return {
    data: { messages, teachers, reports, suggestions },
    repositories: {
      messages: messageRepository,
      teachers: teacherRepository,
      reports: reportRepository,
      suggestions: suggestionRepository,
    },
  };
}

/** Anexos em memória, por página. */
export function memoryAttachments() {
  const files = new Map<string, string>();
  let sequence = 0;
  const store: AttachmentStore = {
    async save(page, documents) {
      return documents.map(document => {
        const fileId = `file-${++sequence}`;
        files.set(`${page}/${fileId}`, document);
        return fileId;
      });
    },
    async discard(page, ids) {
      ids.forEach(fileId => files.delete(`${page}/${fileId}`));
    },
  };
  return { files, store };
}

/** Um banco que o teste liga e desliga. */
export function switchableDatabase(ready = true) {
  const state = { ready };
  return {
    state,
    database: {
      isReady: () => state.ready,
      status: () => (state.ready ? 'connected' : 'disconnected'),
      connect: async () => state.ready,
      disconnect: async () => undefined,
    } satisfies Overrides['database'],
  };
}
