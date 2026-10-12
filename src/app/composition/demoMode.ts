import type {
  DemoBackend,
  DemoPorts,
  DemoScenario,
} from '@root/adapters/outbound/demo';
import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type {
  MessageBoardPort,
  TeacherDirectoryPort,
} from '@root/modules/community/application/ports';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import type { ScheduleGeneratorPort } from '@root/modules/planning/application/ports';
import type { ErrorReporterPort } from '@root/modules/support/application/ports';

/** Outbound ports that demo mode may replace. */
export type SwitchablePorts = {
  authentication: AuthenticationPort;
  records: AcademicRecordsPort;
  messageBoard: MessageBoardPort;
  teacherDirectory: TeacherDirectoryPort;
  errorReporter: ErrorReporterPort;
  scheduleGenerator: ScheduleGeneratorPort;
  preferences: PreferencesStore;
};

export type DemoControl = {
  /** Scenario of the signed-in demo account, or null for a real account. */
  activeScenario(): DemoScenario | null;
};

const ELECTIVE_CREDITS_KEY = 'elective-credits';

/**
 * Development builds only. Metro folds `__DEV__` to `false` in release
 * bundles and drops this branch, so neither the fake adapters nor the
 * fictitious dataset are shipped.
 */
export function loadDemoBackend(): DemoBackend | null {
  if (__DEV__) {
    const demo =
      require('@root/adapters/outbound/demo') as typeof import('@root/adapters/outbound/demo');
    return demo.createDemoBackend();
  }
  return null;
}

/**
 * Routes each port to the real adapter or to the demo backend, decided once
 * per sign-in by the credentials. Without a backend (release builds) the real
 * ports are returned untouched.
 */
export function withDemoMode(
  real: SwitchablePorts,
  backend: DemoBackend | null,
): SwitchablePorts & { demo: DemoControl | null } {
  if (!backend) return { ...real, demo: null };

  let active: { scenario: DemoScenario; ports: DemoPorts } | null = null;
  const demo = () => active?.ports ?? null;

  const authentication: AuthenticationPort = {
    async signIn(credentials) {
      const scenario = backend.scenarioOf(credentials);
      if (scenario === null) {
        active = null;
        return real.authentication.signIn(credentials);
      }
      // Drop any real portal session before switching to fictitious data.
      await real.authentication.signOut();
      const ports = backend.ports(scenario);
      active = { scenario, ports };
      return ports.authentication.signIn(credentials);
    },
    refresh: () => (demo() ?? real).authentication.refresh(),
    async signOut() {
      const previous = demo();
      active = null;
      await Promise.all([
        real.authentication.signOut(),
        previous?.authentication.signOut(),
      ]);
    },
  };

  const records = () => demo()?.records ?? real.records;
  const preferences: PreferencesStore = {
    async read<T>(scope: string, key: string) {
      const stored = await real.preferences.read<T>(scope, key);
      const ports = demo();
      if (stored === null && ports && key === ELECTIVE_CREDITS_KEY)
        return { ...ports.electiveCredits } as T;
      return stored;
    },
    write: (scope, key, value) => real.preferences.write(scope, key, value),
    remove: (scope, key) => real.preferences.remove(scope, key),
  };

  return {
    authentication,
    records: {
      getGrades: options => records().getGrades(options),
      getHistory: options => records().getHistory(options),
      getCurriculum: options => records().getCurriculum(options),
      getSchedule: options => records().getSchedule(options),
      getPartialRid: options => records().getPartialRid(options),
      getSubjectDetails: (subjectId, options) =>
        records().getSubjectDetails(subjectId, options),
      getUniversalSubjects: options => records().getUniversalSubjects(options),
    },
    messageBoard: {
      read: (thread, options) =>
        (demo()?.messageBoard ?? real.messageBoard).read(thread, options),
      post: (message, options) =>
        (demo()?.messageBoard ?? real.messageBoard).post(message, options),
    },
    teacherDirectory: {
      list: options =>
        (demo()?.teacherDirectory ?? real.teacherDirectory).list(options),
      find: (name, options) =>
        (demo()?.teacherDirectory ?? real.teacherDirectory).find(name, options),
    },
    errorReporter: {
      submit: report =>
        (demo()?.errorReporter ?? real.errorReporter).submit(report),
    },
    scheduleGenerator: {
      generate: (request, options) =>
        (demo()?.scheduleGenerator ?? real.scheduleGenerator).generate(
          request,
          options,
        ),
    },
    preferences,
    demo: { activeScenario: () => active?.scenario ?? null },
  };
}
