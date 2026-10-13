import type { AppUpdate, UpdateType } from '../../domain/updatePolicy';
import type {
  AppKeyValueStore,
  AppStatusSource,
  AppUpdatesPort,
  InstallProgress,
  ReviewPromptPort,
  StoreListingPort,
  UpdateFlowResult,
} from '../ports';

/** Cópia como a do AsyncStorage (os valores passam por JSON). */
const copy = (value: unknown) =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

export type MemoryStore = AppKeyValueStore & {
  data: Map<string, unknown>;
  read: jest.Mock;
  write: jest.Mock;
};

export function createMemoryStore(
  initial: Record<string, unknown> = {},
): MemoryStore {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    read: jest.fn(async (key: string) =>
      data.has(key) ? copy(data.get(key)) : null,
    ),
    write: jest.fn(async (key: string, value: unknown) => {
      data.set(key, copy(value));
    }),
  };
}

/** Responde com cada valor em ordem (repete o último); um `Error` rejeita. */
export function createSource(
  ...responses: unknown[]
): AppStatusSource & { fetch: jest.Mock } {
  return {
    fetch: jest.fn(async () => {
      const next = responses.length > 1 ? responses.shift() : responses[0];
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}

export const appUpdate = (overrides: Partial<AppUpdate> = {}): AppUpdate => ({
  availability: 'available',
  versionCode: 10040000,
  stalenessDays: 5,
  priority: 0,
  flexibleAllowed: true,
  immediateAllowed: true,
  installStatus: 'unknown',
  ...overrides,
});

export type FakeUpdatesPort = AppUpdatesPort & {
  check: jest.Mock<Promise<AppUpdate | null>, []>;
  start: jest.Mock<Promise<UpdateFlowResult>, [UpdateType]>;
  complete: jest.Mock<Promise<void>, []>;
  /** Simula o InstallStateUpdatedListener da Play. */
  emit(progress: InstallProgress): void;
  readonly listening: boolean;
};

/** Play In-App Updates simulada; `null` = app fora da Play. */
export function createUpdatesPort(
  update: AppUpdate | null = appUpdate(),
): FakeUpdatesPort {
  let listener: ((progress: InstallProgress) => void) | null = null;
  return {
    check: jest.fn(async () => update),
    start: jest.fn(async (_type: UpdateType): Promise<UpdateFlowResult> => {
      return 'accepted';
    }),
    complete: jest.fn(async () => undefined),
    onInstallProgress(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
    emit(progress) {
      listener?.(progress);
    },
    get listening() {
      return listener !== null;
    },
  };
}

export function createStoreListing(available = true) {
  return {
    available,
    open: jest.fn(async () => undefined),
  } satisfies StoreListingPort;
}

export function createReviewPort(available = true) {
  return {
    isAvailable: jest.fn(() => available),
    request: jest.fn(async () => undefined),
  } satisfies ReviewPromptPort;
}
