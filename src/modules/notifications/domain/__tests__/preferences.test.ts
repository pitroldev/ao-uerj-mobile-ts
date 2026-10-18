import {
  EMPTY_CHECK_STATE,
  isDue,
  isQuietTime,
  normalizeCheckState,
  rememberDocuments,
} from '../checkState';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  hasAnyNotification,
  normalizeNotificationPreferences,
  usesPortalChecks,
} from '../preferences';

describe('normalizeNotificationPreferences', () => {
  it('starts with everything off and the 15-minute lead', () => {
    expect(normalizeNotificationPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toMatchObject({
      classReminders: false,
      grades: false,
      gradeValues: false,
      rid: false,
      documents: false,
      reminderLead: 15,
    });
  });

  it('keeps valid saved values and drops the rest', () => {
    expect(
      normalizeNotificationPreferences({
        classReminders: true,
        reminderLead: 30,
        grades: 'sim',
        rid: true,
        extra: 1,
      }),
    ).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      classReminders: true,
      reminderLead: 30,
      rid: true,
    });
    expect(
      normalizeNotificationPreferences({ reminderLead: 20 }).reminderLead,
    ).toBe(15);
  });

  it('tells which choices need the portal', () => {
    const reminders = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      classReminders: true,
    };
    expect(usesPortalChecks(reminders)).toBe(false);
    expect(hasAnyNotification(reminders)).toBe(true);
    expect(usesPortalChecks({ ...reminders, documents: true })).toBe(true);
    expect(hasAnyNotification(DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false);
  });
});

describe('check state', () => {
  it('reads a saved state defensively', () => {
    expect(normalizeCheckState('x')).toEqual(EMPTY_CHECK_STATE);
    expect(
      normalizeCheckState({
        lastRunAt: 10,
        lastOutcome: 'ok',
        pausedUntil: 'logo',
        notifiedDocuments: ['a', 1, 'b'],
      }),
    ).toEqual({
      ...EMPTY_CHECK_STATE,
      lastRunAt: 10,
      lastOutcome: 'ok',
      notifiedDocuments: ['a', 'b'],
    });
  });

  it('remembers at most 20 notified documents, the newest last', () => {
    const many = Array.from({ length: 25 }, (_, index) => `doc-${index}`);
    const remembered = rememberDocuments(many.slice(0, 20), many.slice(18));
    expect(remembered).toHaveLength(20);
    expect(remembered[19]).toBe('doc-24');
  });

  it.each([
    [6, true],
    [7, false],
    [12, false],
    [21, false],
    [22, true],
    [23, true],
    [0, true],
  ])('at %p:00 quiet is %p', (hour, quiet) => {
    expect(isQuietTime(new Date(2026, 9, 17, hour, 30).getTime())).toBe(quiet);
  });

  it('is due without a previous run, after the interval or after a clock change', () => {
    expect(isDue(null, 100, 50)).toBe(true);
    expect(isDue(60, 100, 50)).toBe(false);
    expect(isDue(50, 100, 50)).toBe(true);
    expect(isDue(200, 100, 50)).toBe(true);
  });
});
