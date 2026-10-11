import { AppError } from '@root/shared/errors/AppError';
export const subjectIdPattern = /\b[A-Z]+\d+-\d+\b/i;
export function requireStructure(condition: unknown): asserts condition {
  if (!condition) throw new AppError('PORTAL_LAYOUT_CHANGED');
}
/** Blank and dash are absent values; malformed numeric text is a contract error. */
export function optionalNumber(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!text || /^[-–—]$/.test(text)) return null;
  requireStructure(/^-?\d+(?:\.\d+)?$/.test(text));
  const number = Number(text);
  requireStructure(Number.isFinite(number));
  return number;
}
export function requiredNumber(value: string): number {
  const number = optionalNumber(value);
  requireStructure(number !== null);
  return number;
}
export function assertFiniteValues(value: unknown): void {
  if (typeof value === 'number') requireStructure(Number.isFinite(value));
  if (Array.isArray(value)) value.forEach(assertFiniteValues);
  else if (value && typeof value === 'object')
    Object.values(value).forEach(assertFiniteValues);
}
