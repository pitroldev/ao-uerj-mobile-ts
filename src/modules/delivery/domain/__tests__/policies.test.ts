import {
  canRequestReview,
  parseReviewHistory,
  recordSession,
  REVIEW_INTERVAL,
  REVIEW_MIN_SESSIONS,
  REVIEW_MIN_USE,
} from '../reviewPolicy';
import {
  chooseUpdate,
  FLEXIBLE_AFTER_DAYS,
  FLEXIBLE_PRIORITY,
  type AppUpdate,
} from '../updatePolicy';

const update = (overrides: Partial<AppUpdate> = {}): AppUpdate => ({
  availability: 'available',
  versionCode: 10030006,
  stalenessDays: FLEXIBLE_AFTER_DAYS,
  priority: 0,
  flexibleAllowed: true,
  immediateAllowed: true,
  installStatus: 'unknown',
  ...overrides,
});

describe('chooseUpdate', () => {
  it('asks for the immediate flow when the installed version is no longer supported', () => {
    expect(chooseUpdate(update({ stalenessDays: 0 }), { required: true })).toBe(
      'immediate',
    );
    // retoma a imediata interrompida
    expect(
      chooseUpdate(update({ availability: 'inProgress' }), { required: true }),
    ).toBe('immediate');
    expect(
      chooseUpdate(update({ immediateAllowed: false }), { required: true }),
    ).toBeNull();
  });

  it('asks for the flexible flow after a few days in the store or with a high priority', () => {
    expect(chooseUpdate(update(), { required: false })).toBe('flexible');
    expect(
      chooseUpdate(update({ stalenessDays: FLEXIBLE_AFTER_DAYS - 1 }), {
        required: false,
      }),
    ).toBeNull();
    expect(
      chooseUpdate(update({ stalenessDays: null }), { required: false }),
    ).toBeNull();
    expect(
      chooseUpdate(update({ stalenessDays: 0, priority: FLEXIBLE_PRIORITY }), {
        required: false,
      }),
    ).toBe('flexible');
  });

  it('asks for nothing when there is no update, it is in progress or already downloaded', () => {
    for (const overrides of [
      { availability: 'none' as const },
      { availability: 'inProgress' as const },
      { flexibleAllowed: false },
      { installStatus: 'downloaded' as const },
    ])
      expect(chooseUpdate(update(overrides), { required: false })).toBeNull();
    expect(
      chooseUpdate(update({ installStatus: 'downloaded' }), { required: true }),
    ).toBeNull();
  });
});

describe('review policy', () => {
  const start = Date.parse('2026-10-01T12:00:00Z');
  const history = (sessions: number, lastRequestAt: number | null = null) => ({
    firstSessionAt: start,
    sessions,
    lastRequestAt,
  });

  it('counts sessions from the first one', () => {
    expect(recordSession(null, start)).toEqual(history(1));
    expect(recordSession(history(3), start + 1)).toEqual(history(4));
  });

  it('waits for a few days and sessions, then for 120 days between requests', () => {
    const ready = start + REVIEW_MIN_USE;
    expect(canRequestReview(null, ready)).toBe(false);
    expect(canRequestReview(history(REVIEW_MIN_SESSIONS), ready - 1)).toBe(
      false,
    );
    expect(canRequestReview(history(REVIEW_MIN_SESSIONS - 1), ready)).toBe(
      false,
    );
    expect(canRequestReview(history(REVIEW_MIN_SESSIONS), ready)).toBe(true);
    const asked = history(REVIEW_MIN_SESSIONS, ready);
    expect(canRequestReview(asked, ready + REVIEW_INTERVAL - 1)).toBe(false);
    expect(canRequestReview(asked, ready + REVIEW_INTERVAL)).toBe(true);
  });

  it('reads a saved history defensively', () => {
    expect(parseReviewHistory(history(2, start))).toEqual(history(2, start));
    expect(parseReviewHistory(null)).toBeNull();
    expect(parseReviewHistory({ firstSessionAt: 'ontem', sessions: 1 })).toBe(
      null,
    );
    expect(
      parseReviewHistory({ firstSessionAt: start, sessions: 1 }),
    ).toBeNull();
  });
});
