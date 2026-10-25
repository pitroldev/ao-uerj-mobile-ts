import type { PartialRidResult } from '../../models';
import {
  isCurrentPartialRid,
  isPastPartialRid,
  ridUpdatedAt,
} from '../partialRid';

const NOW = new Date(2026, 9, 24, 18, 0);
const rid = (updatedAt: string, count = 1): PartialRidResult => ({
  updatedAt,
  subjects: Array.from({ length: count }, (_item, index) => ({
    id: `ABC01-0000${index}`,
    name: 'Disciplina',
    classNumber: 1,
    available: 40,
    requested: 10,
    position: 1,
    status: 'Deferida',
  })),
});

it('reads the date as the portal writes it', () => {
  expect(ridUpdatedAt(' 03/03/2026 ')).toEqual(new Date(2026, 2, 3));
  expect(ridUpdatedAt(' 12/10/2026 14:32 ')).toEqual(new Date(2026, 9, 12));
  expect(ridUpdatedAt('31/02/2026')).toBeNull();
  expect(ridUpdatedAt('')).toBeNull();
});

it('takes a RID updated in the last 30 days as the enrollment in progress', () => {
  expect(isCurrentPartialRid(rid(' 20/10/2026 '), NOW)).toBe(true);
  expect(isCurrentPartialRid(rid(' 25/09/2026 '), NOW)).toBe(true);
  expect(isCurrentPartialRid(rid(' 23/09/2026 '), NOW)).toBe(false);
  // a inscrição do começo do período, que o portal mantém no menu
  expect(isCurrentPartialRid(rid(' 03/03/2026 '), NOW)).toBe(false);
  expect(isPastPartialRid(rid(' 03/03/2026 '), NOW)).toBe(true);
});

it('keeps a RID without a readable date and ignores an empty one', () => {
  expect(isCurrentPartialRid(rid(''), NOW)).toBe(true);
  expect(isCurrentPartialRid(rid(' 03/03/2026 ', 0), NOW)).toBe(false);
  expect(isPastPartialRid(rid(' 03/03/2026 ', 0), NOW)).toBe(false);
  expect(isCurrentPartialRid(undefined, NOW)).toBe(false);
});
