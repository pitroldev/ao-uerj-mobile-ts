import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toPortalStatusResponse } from '../src/adapters/inbound/http/aouerj/status.ts';
import { repeatEvery } from '../src/adapters/inbound/scheduling/repeat.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import {
  INITIAL_STATUS,
  isUp,
  nextStatus,
} from '../src/modules/portal/domain.ts';
import { manualClock } from './support.ts';

test('only gateway errors and silence count as the portal down', () => {
  assert.equal(isUp(200), true);
  // um redirecionamento é o portal respondendo
  assert.equal(isUp(302), true);
  assert.equal(isUp(500), true);
  for (const status of [502, 503, 504]) assert.equal(isUp(status), false);
  assert.equal(isUp(null), false);
});

test('the start of a state only moves when the state changes', () => {
  const up = nextStatus(INITIAL_STATUS, true, 1000);
  assert.deepEqual(up, { state: 'up', since: 1000, checkedAt: 1000 });
  assert.deepEqual(nextStatus(up, true, 2000), {
    state: 'up',
    since: 1000,
    checkedAt: 2000,
  });
  assert.deepEqual(nextStatus(up, false, 3000), {
    state: 'down',
    since: 3000,
    checkedAt: 3000,
  });
});

test('the watch keeps the state, and a probe without an answer is down', async () => {
  const clock = manualClock();
  const answers: (number | Error)[] = [200, 503, new Error('timeout'), 302];
  const watch = createPortalWatch({
    probe: async () => {
      const answer = answers.shift() ?? 200;
      if (answer instanceof Error) throw answer;
      return answer;
    },
    now: clock.now,
  });
  assert.deepEqual(watch.snapshot(), INITIAL_STATUS);

  assert.equal((await watch.check()).state, 'up');
  clock.advance(60_000);
  const down = await watch.check();
  assert.equal(down.state, 'down');
  clock.advance(60_000);
  // a queda continua: o início fica
  assert.equal((await watch.check()).since, down.since);
  clock.advance(60_000);
  const back = await watch.check();
  assert.equal(back.state, 'up');
  assert.equal(back.since, clock.now());
});

test('simultaneous checks share one probe', async () => {
  let probes = 0;
  const watch = createPortalWatch({
    probe: async () => {
      probes += 1;
      return 200;
    },
  });
  await Promise.all([watch.check(), watch.check()]);
  assert.equal(probes, 1);
});

test('the schedule runs the task at once, then on every interval, and survives a failure', async () => {
  const failures: unknown[] = [];
  let runs = 0;
  const schedule = repeatEvery(
    20,
    async () => {
      runs += 1;
      if (runs === 1) throw new Error('first check failed');
    },
    err => failures.push(err),
  );
  schedule.start();
  schedule.start();
  assert.equal(runs, 1);
  await new Promise(resolve => setTimeout(resolve, 70));
  schedule.stop();
  const stoppedAt = runs;
  assert.ok(stoppedAt >= 2, `ran ${stoppedAt} times`);
  assert.equal(failures.length, 1);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(runs, stoppedAt);
});

test('the response has ISO dates and nothing else', () => {
  assert.deepEqual(
    toPortalStatusResponse({
      state: 'down',
      since: Date.UTC(2026, 9, 22, 12),
      checkedAt: Date.UTC(2026, 9, 22, 12, 5),
    }),
    {
      state: 'down',
      since: '2026-10-22T12:00:00.000Z',
      checkedAt: '2026-10-22T12:05:00.000Z',
    },
  );
  assert.deepEqual(toPortalStatusResponse(INITIAL_STATUS), {
    state: 'unknown',
    since: null,
    checkedAt: null,
  });
});
