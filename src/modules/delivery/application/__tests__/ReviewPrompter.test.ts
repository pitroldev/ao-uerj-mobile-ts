import {
  REVIEW_INTERVAL,
  REVIEW_MIN_SESSIONS,
  REVIEW_MIN_USE,
} from '../../domain/reviewPolicy';
import { REVIEW_HISTORY_KEY, ReviewPrompter } from '../ReviewPrompter';
import { createMemoryStore, createReviewPort } from './fakes';

const start = Date.parse('2026-10-01T12:00:00Z');
let now: number;
const prompter = (
  store = createMemoryStore(),
  review = createReviewPort(),
) => ({
  store,
  review,
  prompter: new ReviewPrompter({ review, store, now: () => now }),
});

/** Uma abertura do app com a conta carregada. */
async function session(store: ReturnType<typeof createMemoryStore>) {
  const next = prompter(store);
  await next.prompter.noteSession();
  return next;
}

beforeEach(() => {
  now = start;
});

it('counts each app session once', async () => {
  const { prompter: current, store } = prompter();
  await current.noteSession();
  await current.noteSession();
  expect(store.data.get(REVIEW_HISTORY_KEY)).toEqual({
    firstSessionAt: start,
    sessions: 1,
    lastRequestAt: null,
  });
  await session(store);
  expect(store.data.get(REVIEW_HISTORY_KEY)).toMatchObject({ sessions: 2 });
});

it('asks only after a few days of use and a few sessions', async () => {
  const soon = createMemoryStore();
  for (let i = 0; i < REVIEW_MIN_SESSIONS + 2; i++) await session(soon);
  now = start + REVIEW_MIN_USE - 1;
  const early = await session(soon);
  await expect(early.prompter.notePositiveMoment()).resolves.toBe(false);

  const few = createMemoryStore();
  now = start;
  await session(few);
  now = start + REVIEW_MIN_USE;
  const second = await session(few);
  await expect(second.prompter.notePositiveMoment()).resolves.toBe(false);
  expect(second.review.request).not.toHaveBeenCalled();

  for (let i = 2; i < REVIEW_MIN_SESSIONS - 1; i++) await session(few);
  const enough = await session(few);
  await expect(enough.prompter.notePositiveMoment()).resolves.toBe(true);
  expect(enough.review.request).toHaveBeenCalledTimes(1);
});

it('asks once per session and then waits 120 days', async () => {
  const store = createMemoryStore({
    [REVIEW_HISTORY_KEY]: {
      firstSessionAt: start,
      sessions: REVIEW_MIN_SESSIONS,
      lastRequestAt: null,
    },
  });
  now = start + REVIEW_MIN_USE;
  const first = await session(store);
  await expect(first.prompter.notePositiveMoment()).resolves.toBe(true);
  await expect(first.prompter.notePositiveMoment()).resolves.toBe(false);
  expect(first.review.request).toHaveBeenCalledTimes(1);
  expect(store.data.get(REVIEW_HISTORY_KEY)).toMatchObject({
    lastRequestAt: now,
  });

  const asked = now;
  now = asked + REVIEW_INTERVAL - 1;
  const soon = await session(store);
  await expect(soon.prompter.notePositiveMoment()).resolves.toBe(false);
  now = asked + REVIEW_INTERVAL;
  const later = await session(store);
  await expect(later.prompter.notePositiveMoment()).resolves.toBe(true);
});

it('does not ask where the store review is unavailable, nor fail when it errors', async () => {
  const history = {
    [REVIEW_HISTORY_KEY]: {
      firstSessionAt: start,
      sessions: REVIEW_MIN_SESSIONS,
      lastRequestAt: null,
    },
  };
  now = start + REVIEW_MIN_USE;
  const unavailable = prompter(
    createMemoryStore(history),
    createReviewPort(false),
  );
  await expect(unavailable.prompter.notePositiveMoment()).resolves.toBe(false);

  const failing = prompter(createMemoryStore(history));
  failing.review.request.mockRejectedValueOnce(new Error('no activity'));
  await expect(failing.prompter.notePositiveMoment()).resolves.toBe(true);
});

it('lets the session finish its write before evaluating a positive moment', async () => {
  const store = createMemoryStore({
    [REVIEW_HISTORY_KEY]: {
      firstSessionAt: start,
      sessions: REVIEW_MIN_SESSIONS - 1,
      lastRequestAt: null,
    },
  });
  now = start + REVIEW_MIN_USE;
  const { prompter: current } = prompter(store);
  const noted = current.noteSession();
  const asked = current.notePositiveMoment();
  await noted;
  await expect(asked).resolves.toBe(true);
});
