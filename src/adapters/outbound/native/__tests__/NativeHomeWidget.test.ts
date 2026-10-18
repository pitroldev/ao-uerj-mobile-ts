import { createNativeHomeWidget } from '../NativeHomeWidget';

// fora do Android o TurboModuleRegistry não encontra o módulo
jest.mock('@root/specs/NativeHomeWidget', () => ({
  __esModule: true,
  default: null,
}));

it('is absent where the native module does not exist (iOS)', () => {
  expect(createNativeHomeWidget()).toBeNull();
});

it('hands the schedule to the native side as JSON, or clears it', async () => {
  const module = { setSchedule: jest.fn(async (_json: string) => undefined) };
  const widget = createNativeHomeWidget(module)!;
  const schedule = { updatedAt: 1, expiresAt: 2, classes: [] };
  await widget.setSchedule(schedule);
  await widget.setSchedule(null);
  expect(module.setSchedule.mock.calls).toEqual([
    [JSON.stringify(schedule)],
    [''],
  ]);
});
