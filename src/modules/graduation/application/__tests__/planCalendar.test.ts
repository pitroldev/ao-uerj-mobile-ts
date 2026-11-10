import { planCalendar } from '../planCalendar';
import { postponementAt, postponementIndexes } from '../planInputs';

const calculate = (fields: Partial<Parameters<typeof planCalendar>[0]> = {}) =>
  planCalendar({
    synthesisPeriod: '2017.1',
    accountPeriod: '2017.1',
    correction: undefined,
    remaining: 6,
    ...fields,
  });

const correction = { period: '2016.2', detected: '2017.1' };

it('uses the academic period reported by the portal, regardless of the civil year', () => {
  expect(calculate()).toEqual({
    current: '2017.1',
    detected: '2017.1',
    adjusted: false,
    deadline: '2020.1',
    remaining: 6,
  });
});

it('corrects the base by one semester without moving the official deadline', () => {
  expect(calculate({ correction })).toEqual({
    current: '2016.2',
    detected: '2017.1',
    adjusted: true,
    deadline: '2020.1',
    remaining: 7,
  });
});

it('expires the correction when the portal advances, not when a source is temporarily missing', () => {
  expect(calculate({ correction, synthesisPeriod: '2017.2' })).toMatchObject({
    current: '2017.2',
    adjusted: false,
  });
  expect(calculate({ correction, synthesisPeriod: null })).toMatchObject({
    current: '2016.2',
    adjusted: true,
  });
  expect(
    calculate({
      correction,
      synthesisPeriod: null,
      accountPeriod: 'current',
      remaining: null,
    }),
  ).toEqual({
    current: '2016.2',
    detected: null,
    adjusted: true,
    deadline: null,
    remaining: null,
  });
});

it('rejects invalid periods and never guesses from the wall clock', () => {
  expect(
    calculate({ synthesisPeriod: '2017.3', accountPeriod: '2016.2' }),
  ).toMatchObject({ current: '2016.2', detected: '2016.2' });
  expect(
    calculate({ synthesisPeriod: null, accountPeriod: 'current' }),
  ).toMatchObject({ current: null, deadline: null });
});

it('keeps an overdue deadline overdue after a correction', () => {
  expect(
    calculate({ correction: { period: '2020.2', detected: '2017.1' } }),
  ).toMatchObject({ deadline: '2020.1', remaining: -1 });
});

it('keeps postponements at their chosen semester when the base is corrected', () => {
  const postponed = { '1': postponementAt(1, '2017.1') };
  expect(postponed).toEqual({ '1': { period: '2018.1' } });
  expect(
    postponementIndexes(postponed, calculate({ correction }).current).get('1'),
  ).toBe(2);
});
