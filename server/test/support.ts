import { pino } from 'pino';

import { loadConfig, type Config } from '../src/config.ts';
import type { Overrides } from '../src/composition.ts';
import type {
  IssuanceCounter,
  SingleUse,
} from '../src/modules/access/ports.ts';
import {
  isListed,
  removedStudent,
  type Call,
  type CallReport,
  type DayStats,
} from '../src/modules/companion/domain.ts';
import type {
  CallReportRepository,
  CallRepository,
  CompanionStatsRepository,
  WatcherRepository,
} from '../src/modules/companion/ports.ts';
import type { Message } from '../src/modules/mural/domain.ts';
import type { MessageRepository } from '../src/modules/mural/ports.ts';
import type {
  ErrorReport,
  ReviewFilter,
} from '../src/modules/reports/domain.ts';
import type {
  AttachmentStore,
  ErrorReportRepository,
} from '../src/modules/reports/ports.ts';
import type {
  StoredSession,
  StoredStudent,
} from '../src/modules/students/domain.ts';
import type {
  StudentRepository,
  StudentSessionRepository,
} from '../src/modules/students/ports.ts';
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

  const inReview = ({ status, page }: ReviewFilter) =>
    [...reports]
      .reverse()
      .filter(
        report =>
          (status === 'all' ||
            (status === 'open') === (report.resolvedAt === null)) &&
          (page === undefined || report.page === page),
      );
  const reportRepository: ErrorReportRepository = {
    async create(report) {
      const at = stamp();
      const created = {
        ...report,
        id: id(),
        resolvedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      reports.push(created);
      return created;
    },
    async listRecent(limit) {
      return [...reports].reverse().slice(0, limit);
    },
    async findById(reportId) {
      return reports.find(report => report.id === reportId) ?? null;
    },
    async listForReview(filter, limit) {
      const found = inReview(filter);
      return { reports: found.slice(0, limit), total: found.length };
    },
    async summarize() {
      const pages = new Map<string, { open: number; resolved: number }>();
      for (const report of reports) {
        const entry = pages.get(report.page) ?? { open: 0, resolved: 0 };
        if (report.resolvedAt) entry.resolved += 1;
        else entry.open += 1;
        pages.set(report.page, entry);
      }
      const list = [...pages].map(([page, counts]) => ({ page, ...counts }));
      return {
        open: list.reduce((sum, item) => sum + item.open, 0),
        resolved: list.reduce((sum, item) => sum + item.resolved, 0),
        pages: list.sort((a, b) => b.open - a.open || b.resolved - a.resolved),
      };
    },
    async setResolvedAt(reportId, at) {
      const report = reports.find(item => item.id === reportId);
      if (!report) return null;
      report.resolvedAt = at;
      report.updatedAt = stamp();
      return report;
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

  // os tokens de aluno gastos e os desafios usados: o hash e até quando
  const spent = new Map<string, Date>();
  const usedChallenges = new Map<string, Date>();
  // os lotes por instalação e dia
  const counters = new Map<string, { count: number; until: Date }>();

  const companion = memoryCompanion();
  const people = memoryStudents();

  return {
    data: {
      students: people.students,
      studentSessions: people.sessions,
      messages,
      teachers,
      reports,
      suggestions,
      spent,
      usedChallenges,
      counters,
      calls: companion.calls,
      callReports: companion.reports,
      companionStats: companion.stats,
      watched: companion.watched,
    },
    repositories: {
      messages: messageRepository,
      teachers: teacherRepository,
      reports: reportRepository,
      suggestions: suggestionRepository,
      spentTokens: memorySingleUse(spent),
      usedChallenges: memorySingleUse(usedChallenges),
      issuanceCounters: memoryCounter(counters),
      companionCalls: companion.callRepository,
      companionReports: companion.reportRepository,
      companionStats: companion.statsRepository,
      companionWatchers: companion.watcherRepository,
      students: people.studentRepository,
      studentSessions: people.sessionRepository,
    },
  };
}

/** As chamadas e as denúncias da Companhia agora, como no MongoDB. */
export function memoryCompanion() {
  const calls = new Map<string, Call>();
  const reports: CallReport[] = [];
  const alive = (call: Call | undefined, now: Date): call is Call =>
    Boolean(call && now < call.expiresAt && !call.hiddenAt);
  // cópias, para o caso de uso não mexer no que está guardado
  const copy = (call: Call): Call => structuredClone(call);

  const callRepository: CallRepository = {
    async create(call) {
      calls.set(call.id, copy(call));
    },
    async listListed(now) {
      return [...calls.values()]
        .filter(call => alive(call, now) && isListed(call, now))
        .map(copy);
    },
    async countAlive(now) {
      return [...calls.values()].filter(call => alive(call, now)).length;
    },
    async listAliveWith(student, now) {
      return [...calls.values()]
        .filter(
          call =>
            alive(call, now) &&
            call.members.some(member => member.student === student),
        )
        .map(copy);
    },
    async find(callId, now) {
      const call = calls.get(callId);
      return alive(call, now) ? copy(call) : null;
    },
    async addMember(callId, member, now) {
      const call = calls.get(callId);
      if (!alive(call, now) || !isListed(call, now)) return null;
      if (call.members.length >= call.capacity) return null;
      const { student } = member;
      if (
        student &&
        (call.members.some(item => item.student === student) ||
          call.removed.includes(removedStudent(student)))
      )
        return null;
      call.members.push(structuredClone(member));
      return copy(call);
    },
    async removeMember(callId, member) {
      const call = calls.get(callId);
      if (call)
        call.members = call.members.filter(
          item => item.host || item.id !== member,
        );
    },
    async end(callId, now) {
      const call = calls.get(callId);
      if (call && !call.endedAt) call.endedAt = now;
    },
    async addFeed(callId, entry, keep, now) {
      const call = calls.get(callId);
      if (!alive(call, now) || call.endedAt) return null;
      if (!call.members.some(member => member.id === entry.member)) return null;
      call.feed = [...call.feed, structuredClone(entry)].slice(-keep);
      return copy(call);
    },
    async addReporter(callId, reporter, now) {
      const call = calls.get(callId);
      if (!alive(call, now) || call.reporters.includes(reporter)) return null;
      call.reporters.push(reporter);
      return copy(call);
    },
    async hide(callId, now) {
      const call = calls.get(callId);
      if (call && !call.hiddenAt) call.hiddenAt = now;
    },
    async expel(callId, member) {
      const call = calls.get(callId);
      if (!call) return;
      call.members = call.members.filter(
        item => item.host || item.id !== member,
      );
      if (!call.removed.includes(member)) call.removed.push(member);
    },
    async mark(callId, field, now) {
      const call = calls.get(callId);
      if (!call || call[field]) return false;
      call[field] = now;
      return true;
    },
  };

  let sequence = 0;
  const reportRepository: CallReportRepository = {
    async create(report) {
      reports.push({ ...structuredClone(report), id: `report-${++sequence}` });
    },
    async listRecent(limit) {
      return [...reports].reverse().slice(0, limit);
    },
    async markHidden(callId) {
      for (const report of reports)
        if (report.callId === callId) report.hidden = true;
    },
  };

  // os números do dia e quem olhou a lista, como no MongoDB
  const stats = new Map<string, DayStats['counts']>();
  const statsRepository: CompanionStatsRepository = {
    async add(day, counts) {
      const current = stats.get(day) ?? {};
      for (const [key, value] of Object.entries(counts))
        current[key as keyof typeof current] =
          (current[key as keyof typeof current] ?? 0) + (value ?? 0);
      stats.set(day, current);
    },
    async listRecent(days) {
      return [...stats.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, days)
        .map(([day, counts]) => ({ day, counts: { ...counts } }));
    },
  };
  const watched = new Map<string, Date>();
  const watcherRepository: WatcherRepository = {
    async see(viewer, now, until) {
      const before = watched.get(viewer);
      watched.set(viewer, until);
      return !before || before <= now;
    },
    async count(now) {
      return [...watched.values()].filter(until => until > now).length;
    },
  };

  return {
    calls,
    reports,
    stats,
    watched,
    callRepository,
    reportRepository,
    statsRepository,
    watcherRepository,
  };
}

/** Os alunos e as sessões, como no MongoDB (o `lookup` é único). */
export function memoryStudents() {
  const students = new Map<string, StoredStudent>();
  const sessions = new Map<string, StoredSession>();
  const copy = <T>(value: T): T => structuredClone(value);

  const studentRepository: StudentRepository = {
    async findByLookup(lookup) {
      const found = [...students.values()].find(item => item.lookup === lookup);
      return found ? copy(found) : null;
    },
    async create(student) {
      const existing = [...students.values()].find(
        item => item.lookup === student.lookup,
      );
      if (existing) return copy(existing);
      students.set(student.id, copy(student));
      return copy(student);
    },
    async seen(id, { name, device, now, keepDevices }) {
      const student = students.get(id);
      if (!student) return null;
      student.name = name;
      student.lastSeenAt = now;
      const known = student.devices.find(item => item.id === device);
      if (known) known.lastSeenAt = now;
      else
        student.devices = [
          ...student.devices,
          { id: device, firstSeenAt: now, lastSeenAt: now },
        ]
          .sort((a, b) => a.lastSeenAt.getTime() - b.lastSeenAt.getTime())
          .slice(-keepDevices);
      return copy(student);
    },
    async findById(id) {
      const found = students.get(id);
      return found ? copy(found) : null;
    },
    async findMany(ids) {
      return ids.flatMap(id => {
        const found = students.get(id);
        return found ? [copy(found)] : [];
      });
    },
    async setBan(id, ban) {
      const student = students.get(id);
      if (!student) return null;
      student.ban = ban ? copy(ban) : null;
      return copy(student);
    },
    async listRecent(limit) {
      return [...students.values()]
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .slice(0, limit)
        .map(copy);
    },
    async listBanned(now, limit) {
      return [...students.values()]
        .filter(item => item.ban && (!item.ban.until || item.ban.until > now))
        .sort((a, b) => (b.ban?.at.getTime() ?? 0) - (a.ban?.at.getTime() ?? 0))
        .slice(0, limit)
        .map(copy);
    },
  };

  const sessionRepository: StudentSessionRepository = {
    async create(session) {
      sessions.set(session.id, copy(session));
    },
    async find(id, now) {
      const found = sessions.get(id);
      return found && found.expiresAt > now ? copy(found) : null;
    },
    async touch(id, now, expiresAt) {
      const found = sessions.get(id);
      if (found) {
        found.lastUsedAt = now;
        found.expiresAt = expiresAt;
      }
    },
    async remove(id) {
      sessions.delete(id);
    },
  };

  return { students, sessions, studentRepository, sessionRepository };
}

/** O que só vale uma vez, como no MongoDB. */
export function memorySingleUse(store = new Map<string, Date>()): SingleUse {
  return {
    async spend(id, until) {
      if (store.has(id)) return false;
      store.set(id, until);
      return true;
    },
  };
}

/** Os lotes por instalação e dia, como no MongoDB. */
export function memoryCounter(
  store = new Map<string, { count: number; until: Date }>(),
): IssuanceCounter {
  return {
    async count(id, limit, until) {
      const current = store.get(id);
      if (current && current.count >= limit) return false;
      store.set(id, {
        count: (current?.count ?? 0) + 1,
        until: current?.until ?? until,
      });
      return true;
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
    async read(page, fileId, { maxBytes } = {}) {
      const text = files.get(`${page}/${fileId}`);
      if (text === undefined) return null;
      const bytes = Buffer.byteLength(text);
      return {
        bytes,
        text: maxBytes === undefined ? text : text.slice(0, maxBytes),
      };
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
