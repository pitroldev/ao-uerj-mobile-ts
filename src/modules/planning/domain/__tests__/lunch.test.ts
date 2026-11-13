import {
  LUNCH_MINUTES,
  LUNCH_WINDOW,
  daysWithoutLunch,
  leavesLunch,
  lunchBreak,
} from '../lunch';
import type { Schedule } from '../models';

/** Um tempo da UERJ num dia (0 = segunda). */
const slot = (week_day: number, start: number, end: number): Schedule => ({
  week_day,
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});
const M5 = (day: number) => slot(day, 640, 690);
const M6 = (day: number) => slot(day, 690, 740);
const T1 = (day: number) => slot(day, 740, 800);
const T2 = (day: number) => slot(day, 800, 850);
const T3 = (day: number) => slot(day, 860, 910);
const NIGHT = (day: number) => slot(day, 1080, 1230);

const ONE = lunchBreak(LUNCH_MINUTES.oneSlot)!;
const TWO = lunchBreak(LUNCH_MINUTES.twoSlots)!;

describe('lunchBreak', () => {
  it('is off without minutes and uses the M6 to T2 window otherwise', () => {
    expect(lunchBreak(null)).toBeNull();
    expect(lunchBreak(0)).toBeNull();
    expect(lunchBreak(Number.NaN)).toBeNull();
    expect(ONE).toEqual({ ...LUNCH_WINDOW, minutes: 50 });
    // nunca pede mais que a janela inteira
    expect(lunchBreak(999)).toEqual({ ...LUNCH_WINDOW, minutes: 160 });
  });
});

describe('daysWithoutLunch', () => {
  it('passes a day with one free slot inside the window', () => {
    expect(leavesLunch([M5(0), M6(0), T2(0), T3(0)], ONE)).toBe(true);
    expect(leavesLunch([M6(0), T1(0), T3(0)], ONE)).toBe(true);
  });

  it('fails the day whose classes take M6, T1 and T2', () => {
    expect(daysWithoutLunch([M6(1), T1(1), T2(1), NIGHT(3)], ONE)).toEqual([1]);
    // um bloco só, do M5 ao T3, também
    expect(daysWithoutLunch([slot(2, 640, 910)], ONE)).toEqual([2]);
  });

  it('passes days with classes only before, only after or far from lunch', () => {
    expect(leavesLunch([slot(0, 420, 740)], ONE)).toBe(true);
    expect(leavesLunch([T3(0), slot(0, 910, 1070)], ONE)).toBe(true);
    expect(leavesLunch([NIGHT(0), NIGHT(4)], ONE)).toBe(true);
    expect(leavesLunch([], ONE)).toBe(true);
  });

  it('asks for two slots in a row when the student wants a longer lunch', () => {
    // M6 e T2 livres, mas separados pelo T1: 50 + 50 não dão o almoço longo
    expect(leavesLunch([T1(0)], ONE)).toBe(true);
    expect(leavesLunch([T1(0)], TWO)).toBe(false);
    expect(leavesLunch([M6(0)], TWO)).toBe(true);
    expect(leavesLunch([T2(0)], TWO)).toBe(true);
  });

  it('counts overlapping classes once and judges each day on its own', () => {
    expect(
      daysWithoutLunch(
        [slot(0, 690, 800), slot(0, 700, 850), M6(2), T1(4), T2(4), M6(4)],
        ONE,
      ),
    ).toEqual([0, 4]);
  });
});
