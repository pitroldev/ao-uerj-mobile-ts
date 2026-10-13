import { parseThemePreference, resolveColorScheme } from '../themePreference';

it.each([
  ['light', 'light'],
  ['dark', 'dark'],
  ['system', 'system'],
  [null, 'system'],
  ['DARK', 'system'],
  [{ theme: 'dark' }, 'system'],
])('reads the saved value %p as %p', (saved, expected) => {
  expect(parseThemePreference(saved)).toBe(expected);
});

it('uses the device scheme only when following the system', () => {
  expect(resolveColorScheme('system', 'dark')).toBe('dark');
  expect(resolveColorScheme('system', 'light')).toBe('light');
  expect(resolveColorScheme('light', 'dark')).toBe('light');
  expect(resolveColorScheme('dark', 'light')).toBe('dark');
});

it('falls back to light when the platform has no color scheme', () => {
  expect(resolveColorScheme('system', null)).toBe('light');
  expect(resolveColorScheme('system', undefined)).toBe('light');
});
