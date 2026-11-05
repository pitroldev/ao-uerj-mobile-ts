import { GOOD_NEWS_SEEN_KEY, GoodNews } from '../GoodNews';
import { CHECK_STATE_KEY } from '../NotificationSettings';
import { createStore } from './fakes';

const DAY = 24 * 60 * 60 * 1000;
const NEWS = Date.UTC(2026, 10, 23, 15);

function setup({
  goodNewsAt = NEWS,
  now = NEWS + 60_000,
}: { goodNewsAt?: number | null; now?: number } = {}) {
  const store = createStore({
    [`conta/${CHECK_STATE_KEY}`]: { lastRunAt: NEWS, goodNewsAt },
  });
  const current = {
    account: { scope: 'conta', period: '2026.2' } as {
      scope: string;
      period: string;
    } | null,
  };
  const clock = { now };
  const goodNews = new GoodNews({
    store,
    account: () => current.account,
    now: () => clock.now,
  });
  return { goodNews, store, current, clock };
}

it('counts a good news once', async () => {
  const { goodNews, store } = setup();
  await expect(goodNews.take()).resolves.toBe(true);
  expect(store.data.get(`conta/${GOOD_NEWS_SEEN_KEY}`)).toBe(NEWS);
  await expect(goodNews.take()).resolves.toBe(false);
});

it('counts the next good news, after the one already seen', async () => {
  const { goodNews, store, clock } = setup();
  await goodNews.take();
  store.data.set(`conta/${CHECK_STATE_KEY}`, { goodNewsAt: NEWS + DAY });
  clock.now = NEWS + DAY + 60_000;
  await expect(goodNews.take()).resolves.toBe(true);
});

it('lets an old good news go without counting it', async () => {
  const { goodNews, store } = setup({ now: NEWS + 4 * DAY });
  await expect(goodNews.take()).resolves.toBe(false);
  // e não volta mais
  expect(store.data.get(`conta/${GOOD_NEWS_SEEN_KEY}`)).toBe(NEWS);
});

it('does not count a good news from the future, after the clock moved back', async () => {
  const { goodNews, store } = setup({ now: NEWS - DAY });
  await expect(goodNews.take()).resolves.toBe(false);
  expect(store.data.get(`conta/${GOOD_NEWS_SEEN_KEY}`)).toBe(NEWS);
});

it('does nothing without news or without an account', async () => {
  await expect(setup({ goodNewsAt: null }).goodNews.take()).resolves.toBe(
    false,
  );
  const { goodNews, current, store } = setup();
  current.account = null;
  await expect(goodNews.take()).resolves.toBe(false);
  expect(store.write).not.toHaveBeenCalled();
});
