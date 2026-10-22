import {
  canTryPortal,
  PORTAL_UP,
  portalFailed,
  portalResponded,
  RETRY_WAITS,
  SLOW_RESPONSE_MS,
} from '../portalAvailability';

const NOW = Date.UTC(2026, 9, 22, 14, 5);

it('takes two network failures in a row to call the portal down', () => {
  const once = portalFailed(PORTAL_UP, 'network', NOW);
  expect(once.state).toBe('up');
  expect(canTryPortal(once, NOW)).toBe(true);
  const twice = portalFailed(once, 'network', NOW + 1000);
  expect(twice).toMatchObject({
    state: 'down',
    since: NOW + 1000,
    retryAt: NOW + 1000 + RETRY_WAITS[0],
  });
});

it('calls the portal down at once when it says it is unavailable', () => {
  expect(portalFailed(PORTAL_UP, 'unavailable', NOW)).toMatchObject({
    state: 'down',
    since: NOW,
  });
});

it('waits longer after each failed attempt, up to the last wait', () => {
  let state = portalFailed(PORTAL_UP, 'unavailable', NOW);
  const waits = [state.retryAt! - NOW];
  for (let attempt = 1; attempt < RETRY_WAITS.length + 2; attempt += 1) {
    state = portalFailed(state, 'network', NOW);
    waits.push(state.retryAt! - NOW);
  }
  expect(waits).toEqual([
    ...RETRY_WAITS,
    RETRY_WAITS[RETRY_WAITS.length - 1],
    RETRY_WAITS[RETRY_WAITS.length - 1],
  ]);
  // a queda segue com o início da primeira falha
  expect(state.since).toBe(NOW);
});

it('blocks reads until the next attempt', () => {
  const down = portalFailed(PORTAL_UP, 'unavailable', NOW);
  expect(canTryPortal(down, NOW + RETRY_WAITS[0] - 1)).toBe(false);
  expect(canTryPortal(down, NOW + RETRY_WAITS[0])).toBe(true);
});

it('clears the failures on an answer and flags a slow one', () => {
  expect(portalResponded(300)).toEqual(PORTAL_UP);
  expect(portalResponded(SLOW_RESPONSE_MS)).toEqual({
    ...PORTAL_UP,
    slow: true,
  });
});
