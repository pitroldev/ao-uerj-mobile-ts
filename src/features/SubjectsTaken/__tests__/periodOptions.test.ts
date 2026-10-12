import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { buildPeriodOptions } from '../periodOptions';

const taken = (
  period: string,
  status: SubjectsTaken['status'],
  grade: number | null,
): SubjectsTaken => ({
  id: `IME01-${period}`,
  name: 'Disciplina',
  period,
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade,
  status,
});

it('marks the period in progress, the current CR and leaves exemptions without CR', () => {
  const options = buildPeriodOptions([
    taken('Isenções', 'EXEMPT', null),
    taken('2025.1', 'APPROVED', 8),
    taken('2025.2', 'APPROVED', 6),
    taken('2026.1', 'IN_PROGRESS', null),
  ]);
  expect(options).toEqual([
    { value: '2026.1', label: '2026.1', aside: 'Em curso' },
    { value: '2025.2', label: '2025.2', aside: 'CR atual 7,00' },
    { value: '2025.1', label: '2025.1', aside: 'CR 8,00' },
    { value: 'Isenções', label: 'Isenções' },
  ]);
});

it('returns no options without history', () => {
  expect(buildPeriodOptions([])).toEqual([]);
});
