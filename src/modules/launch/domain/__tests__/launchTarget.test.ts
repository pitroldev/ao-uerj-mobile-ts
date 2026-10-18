import { needsAccount, toLaunchTarget } from '../launchTarget';

it.each([
  ['home', 'home'],
  ['grades', 'grades'],
  ['map', 'map'],
  ['documents', 'documents'],
  ['outra', null],
  [null, null],
  [undefined, null],
])('reads %p as %p', (value, target) => {
  expect(toLaunchTarget(value)).toBe(target);
});

it('opens only the map without an account', () => {
  expect(needsAccount('map')).toBe(false);
  expect(needsAccount('home')).toBe(true);
  expect(needsAccount('grades')).toBe(true);
  expect(needsAccount('documents')).toBe(true);
});
