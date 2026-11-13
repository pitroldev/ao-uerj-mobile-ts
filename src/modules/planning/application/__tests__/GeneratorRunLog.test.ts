import { GeneratorRunLog } from '../GeneratorRunLog';

const HOUR = 60 * 60 * 1000;

function setup() {
  let now = 0;
  const log = new GeneratorRunLog(() => now);
  return { log, advance: (ms: number) => (now += ms) };
}

it('merges the notes of the current attempt for the same account', () => {
  const { log } = setup();
  log.note('conta-1', { step: 1, busySlots: 72 });
  log.note('conta-1', { step: 4, eligibleSubjects: 7 });
  expect(log.read('conta-1')).toEqual({
    step: 4,
    outcome: 'NOT_RUN',
    busySlots: 72,
    eligibleSubjects: 7,
  });
});

it('hides the attempt from another account and starts over for it', () => {
  const { log } = setup();
  log.note('conta-1', { step: 6, outcome: 'EMPTY' });
  expect(log.read('conta-2')).toBeNull();
  expect(log.read(undefined)).toBeNull();
  log.note('conta-2', { step: 1 });
  expect(log.read('conta-1')).toBeNull();
  expect(log.read('conta-2')).toEqual({ step: 1, outcome: 'NOT_RUN' });
});

it('forgets the previous attempt on start and an attempt older than a day', () => {
  const { log, advance } = setup();
  log.note('conta-1', { step: 6, outcome: 'EMPTY', schedules: 0 });
  log.start('conta-1');
  expect(log.read('conta-1')).toEqual({ step: 0, outcome: 'NOT_RUN' });
  advance(24 * HOUR + 1);
  expect(log.read('conta-1')).toBeNull();
});
