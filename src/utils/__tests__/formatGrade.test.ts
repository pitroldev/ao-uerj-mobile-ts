import { formatGrade } from '../formatGrade';

it('shows one decimal and the second only when it exists', () => {
  expect(formatGrade(8.5)).toBe('8,5');
  expect(formatGrade(7)).toBe('7,0');
  expect(formatGrade(10)).toBe('10,0');
  expect(formatGrade(7.75)).toBe('7,75');
  expect(formatGrade(5.15)).toBe('5,15');
  expect(formatGrade(0.1 + 0.2)).toBe('0,3');
});

it('cuts instead of rounding, so a grade below 5 or 7 never shows as 5,0 or 7,0', () => {
  expect(formatGrade(4.95)).toBe('4,95');
  expect(formatGrade(4.9975)).toBe('4,99');
  expect(formatGrade(6.995)).toBe('6,99');
  expect(formatGrade(5.025)).toBe('5,02');
});
