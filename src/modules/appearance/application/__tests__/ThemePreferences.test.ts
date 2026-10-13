import type { ThemePreference } from '../../domain/themePreference';
import type { AppearanceStore } from '../ports';
import { THEME_PREFERENCE_KEY, ThemePreferences } from '../ThemePreferences';

function createStore(saved?: unknown) {
  const data = new Map<string, unknown>();
  if (saved !== undefined) data.set(THEME_PREFERENCE_KEY, saved);
  const store = {
    data,
    read: jest.fn(async (key: string) => data.get(key) ?? null),
    write: jest.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
  };
  return store as typeof store & AppearanceStore;
}

function setup(store = createStore()) {
  const native = { apply: jest.fn<void, [ThemePreference]>() };
  const appearance = new ThemePreferences({ store, native });
  const listener = jest.fn();
  appearance.subscribe(listener);
  return { appearance, store, native, listener };
}

it('follows the system until the saved choice is read', async () => {
  const { appearance, native, listener } = setup(createStore('dark'));
  expect(appearance.getSnapshot()).toBe('system');
  await appearance.start();
  expect(appearance.getSnapshot()).toBe('dark');
  expect(native.apply).toHaveBeenCalledWith('dark');
  expect(listener).toHaveBeenCalledTimes(1);
});

it.each([undefined, 'system', 'sépia'])(
  'leaves the native side alone when the saved value is %p',
  async saved => {
    const { appearance, native, listener } = setup(createStore(saved));
    await appearance.start();
    expect(appearance.getSnapshot()).toBe('system');
    expect(native.apply).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  },
);

it('reads the saved choice only once', async () => {
  const { appearance, store } = setup(createStore('light'));
  await Promise.all([appearance.start(), appearance.start()]);
  await appearance.start();
  expect(store.read).toHaveBeenCalledTimes(1);
});

it('applies a choice at once, tells the native side and saves it', async () => {
  const { appearance, store, native, listener } = setup();
  await appearance.start();
  await appearance.choose('dark');
  expect(appearance.getSnapshot()).toBe('dark');
  expect(native.apply).toHaveBeenLastCalledWith('dark');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.data.get(THEME_PREFERENCE_KEY)).toBe('dark');

  await appearance.choose('system');
  expect(appearance.getSnapshot()).toBe('system');
  expect(native.apply).toHaveBeenLastCalledWith('system');
  expect(store.data.get(THEME_PREFERENCE_KEY)).toBe('system');
});

it('does not notify again when the same option is chosen', async () => {
  const { appearance, native, listener } = setup();
  await appearance.choose('light');
  await appearance.choose('light');
  expect(native.apply).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('keeps a choice made while the saved one is still being read', async () => {
  const store = createStore('light');
  let release!: () => void;
  store.read.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = () => resolve('light');
      }),
  );
  const { appearance, native } = setup(store);
  const started = appearance.start();
  await appearance.choose('dark');
  release();
  await started;
  expect(appearance.getSnapshot()).toBe('dark');
  expect(native.apply).toHaveBeenCalledTimes(1);
  expect(native.apply).toHaveBeenCalledWith('dark');
});

it('still applies the choice when the storage fails', async () => {
  const store = createStore();
  store.read.mockRejectedValueOnce(new Error('disco cheio'));
  store.write.mockRejectedValueOnce(new Error('disco cheio'));
  const { appearance, native } = setup(store);
  await expect(appearance.start()).resolves.toBeUndefined();
  expect(appearance.getSnapshot()).toBe('system');
  await expect(appearance.choose('dark')).resolves.toBeUndefined();
  expect(appearance.getSnapshot()).toBe('dark');
  expect(native.apply).toHaveBeenCalledWith('dark');
});

it('stops notifying after unsubscribing', async () => {
  const { appearance } = setup();
  const listener = jest.fn();
  const unsubscribe = appearance.subscribe(listener);
  unsubscribe();
  await appearance.choose('dark');
  expect(listener).not.toHaveBeenCalled();
});
