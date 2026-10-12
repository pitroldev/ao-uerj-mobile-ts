import type {
  AcademicRecordsPort,
  AcademicRequestOptions,
} from '@root/modules/academics/application/ports';
import type { ElectiveCreditsConfig } from '@root/modules/academics/domain/rules/progress';
import type {
  MessageBoardPort,
  TeacherDirectoryPort,
} from '@root/modules/community/application/ports';
import type { Message } from '@root/modules/community/domain/models';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import type { Credentials } from '@root/modules/identity/domain/types';
import type { ScheduleGeneratorPort } from '@root/modules/planning/application/ports';
import type { ErrorReporterPort } from '@root/modules/support/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import {
  demoCredentials,
  demoScenarioOf,
  type DemoScenario,
} from './credentials';
import {
  CURRICULUM,
  DEMO_ELECTIVE_CREDITS,
  DEMO_STUDENT,
  GRADES,
  HISTORY,
  PARTIAL_RID,
  SCHEDULE,
  UNIVERSALS,
  demoTeachers,
  findSubjectDetails,
  initialMessages,
} from './data';
import { createDemoScheduleGenerator } from './scheduleGenerator';
import { wait } from './wait';

export type DemoPorts = {
  authentication: AuthenticationPort;
  records: AcademicRecordsPort;
  messageBoard: MessageBoardPort;
  teacherDirectory: TeacherDirectoryPort;
  errorReporter: ErrorReporterPort;
  scheduleGenerator: ScheduleGeneratorPort;
  electiveCredits: ElectiveCreditsConfig;
};

export type DemoBackend = {
  /** null for every credential that is not a demo credential. */
  scenarioOf(credentials: Credentials): DemoScenario | null;
  ports(scenario: DemoScenario): DemoPorts;
};

export type DemoBackendOptions = {
  /** Simulated portal latency (ms). */
  latencyMs?: number;
  /** Latency of the "lento" scenario (ms). */
  slowLatencyMs?: number;
};

/** Callers receive copies, never the shared fixtures. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** "IME02-10892" matches "10892" and turma "02" matches "2", as in the portal. */
function sameCode(left: string, right: string) {
  const numeric = (value: string) => Number(value.split('-').pop());
  const [a, b] = [numeric(left), numeric(right)];
  return Number.isFinite(a) && Number.isFinite(b)
    ? a === b
    : left.trim() === right.trim();
}

function createRecords(
  scenario: DemoScenario,
  latencyMs: number,
): AcademicRecordsPort {
  const respond = async <T>(
    read: () => T,
    options?: AcademicRequestOptions,
  ): Promise<T> => {
    await wait(latencyMs, options?.signal);
    if (scenario === 'bloqueado') throw new AppError('POSSIBLY_BLOCKED');
    if (scenario === 'erro') throw new AppError('PORTAL_LAYOUT_CHANGED');
    return copy(read());
  };
  const enrollmentClosed = scenario === 'rid' || scenario === 'vazio';
  return {
    getGrades: options =>
      respond(() => (enrollmentClosed ? [] : GRADES), options),
    getSchedule: options =>
      respond(() => (enrollmentClosed ? [] : SCHEDULE), options),
    getPartialRid: options =>
      respond(
        () =>
          scenario === 'vazio' ? { subjects: [], updatedAt: '' } : PARTIAL_RID,
        options,
      ),
    getHistory: options => respond(() => HISTORY, options),
    getCurriculum: options => respond(() => CURRICULUM, options),
    getUniversalSubjects: options => respond(() => UNIVERSALS, options),
    getSubjectDetails: (subjectId, options) =>
      respond(() => {
        // Like the real adapter, accept the full AO id ("IME02-10880", sent
        // by the schedule generator) or its numeric suffix ("10880").
        const details = findSubjectDetails(
          String(subjectId).split('-').pop() ?? '',
        );
        // The portal answers unknown codes with a page the parser rejects.
        if (!details) throw new AppError('PORTAL_LAYOUT_CHANGED');
        return details;
      }, options),
  };
}

function createMessageBoard(latencyMs: number): MessageBoardPort {
  const messages: Message[] = initialMessages();
  let sequence = messages.length;
  return {
    async read(thread, options) {
      await wait(latencyMs, options?.signal);
      return copy(
        messages.filter(
          message =>
            message.period === thread.period &&
            sameCode(message.subjectId, thread.subjectId) &&
            sameCode(message.classNumber, thread.classNumber),
        ),
      );
    },
    async post(input, options) {
      await wait(latencyMs, options?.signal);
      sequence += 1;
      const message: Message = {
        id: `demo-message-${sequence}`,
        authorName: input.authorName,
        subjectId: input.subjectId,
        classNumber: input.classNumber,
        period: input.period,
        text: input.text,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      return copy(message);
    },
  };
}

function createTeacherDirectory(latencyMs: number): TeacherDirectoryPort {
  const teachers = demoTeachers();
  return {
    async list(options) {
      await wait(latencyMs, options?.signal);
      return teachers.map(teacher => teacher.name);
    },
    async find(name, options) {
      await wait(latencyMs, options?.signal);
      const wanted = name.trim().toLowerCase();
      const found = teachers.find(
        teacher => teacher.name.toLowerCase() === wanted,
      );
      return found ? copy(found) : null;
    },
  };
}

/**
 * Fake implementations of every outbound port used by the app, backed by the
 * fictitious dataset in ./data. Development builds only (see demoMode.ts).
 */
export function createDemoBackend({
  latencyMs = 250,
  slowLatencyMs = 30_000,
}: DemoBackendOptions = {}): DemoBackend {
  const cache = new Map<DemoScenario, DemoPorts>();
  // The board keeps posted messages for the whole app session.
  const messageBoard = createMessageBoard(latencyMs);
  const teacherDirectory = createTeacherDirectory(latencyMs);
  const errorReporter: ErrorReporterPort = {
    // No network: reports written in demo mode are discarded.
    submit: () => wait(latencyMs),
  };
  const scheduleGenerator = createDemoScheduleGenerator(latencyMs * 3);

  function build(scenario: DemoScenario): DemoPorts {
    // Like the real adapter, the profile echoes the matricula typed at
    // sign-in; the credential vault rejects accounts where they differ.
    let matricula = demoCredentials(scenario).matricula;
    const profile = () => ({ ...DEMO_STUDENT, matricula });
    return {
      authentication: {
        async signIn(credentials) {
          if (demoScenarioOf(credentials) !== scenario)
            throw new AppError('LOGIN_FAILED');
          await wait(latencyMs);
          matricula = credentials.matricula;
          return profile();
        },
        async refresh() {
          await wait(latencyMs);
          return profile();
        },
        signOut: async () => undefined,
      },
      records: createRecords(
        scenario,
        scenario === 'lento' ? slowLatencyMs : latencyMs,
      ),
      messageBoard,
      teacherDirectory,
      errorReporter,
      scheduleGenerator,
      electiveCredits: { ...DEMO_ELECTIVE_CREDITS },
    };
  }

  return {
    scenarioOf: demoScenarioOf,
    ports(scenario) {
      const existing = cache.get(scenario);
      if (existing) return existing;
      const created = build(scenario);
      cache.set(scenario, created);
      return created;
    },
  };
}
