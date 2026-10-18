import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import type { Absence } from '@root/modules/attendance/domain/attendance';
import { renderWithProviders } from '@root/test-utils/render';

import { AttendanceSheet } from '../AttendanceSheet';

let mockAbsences: Absence[] = [];
const mockMark = jest.fn(async () => true);
jest.mock('@root/modules/attendance/presentation/useAttendance', () => ({
  useAttendance: () => ({
    absences: mockAbsences,
    keys: new Set(mockAbsences.map(a => `${a.subjectId}@${a.date}@${a.start}`)),
    mark: mockMark,
  }),
}));
let mockWorkload: number | null = 60;
let mockFailed = false;
const mockRetry = jest.fn();
jest.mock('@root/modules/academics/presentation/useSubjectLoads', () => ({
  useSubjectLoads: () => ({
    loads: new Map(
      mockWorkload === null
        ? []
        : [['778', { credits: 4, workload: mockWorkload }]],
    ),
    loading: false,
    failed: mockFailed,
    retry: mockRetry,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const FIS = {
  id: 'IME02-00778',
  name: 'Física Experimental II',
  class: '2',
  avaLocation: '',
  uerjLocation: 'Pav. João Lyra Filho · 3º andar · Sala 3021 F',
  status: 'ACTIVE',
};
// quintas, 14:20–16:00 (T3–T4)
const SCHEDULE: AttendedClassesSchedule[] = [
  {
    class: FIS,
    dayAlias: '',
    dayNumber: 4,
    subject_id: FIS.id,
    periodAlias: 'T3',
    startTimeAlias: '14:20',
    endTimeAlias: '16:00',
    start_time_in_minutes: 860,
    end_time_in_minutes: 960,
  },
];
/** Sexta, 16/10/2026, 10:24. */
const NOW = new Date(2026, 9, 16, 10, 24);

const renderSheet = () =>
  renderWithProviders(
    <AttendanceSheet
      visible
      onClose={jest.fn()}
      subject={FIS}
      data={SCHEDULE}
      focus={null}
      now={NOW}
    />,
  );

beforeEach(() => {
  mockAbsences = [];
  mockWorkload = 60;
  mockFailed = false;
  mockMark.mockClear().mockResolvedValue(true);
});

it('counts the absences against 25% of the workload', async () => {
  mockAbsences = [
    { subjectId: '778', date: '2026-10-15', start: 860, end: 960, slots: 2 },
    { subjectId: '778', date: '2026-10-08', start: 860, end: 960, slots: 2 },
    { subjectId: '778', date: '2026-10-01', start: 860, end: 960, slots: 2 },
    { subjectId: '778', date: '2026-09-24', start: 860, end: 960, slots: 2 },
  ];
  await renderSheet();
  expect(
    screen.getByLabelText(
      'Faltas no período: 8 de 15 tempos. Ainda pode faltar 7 tempos (3 aulas). Carga horária: 60 h. Presença mínima: 75%.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText('60 h')).toBeOnTheScreen();
  expect(screen.getByText('75%')).toBeOnTheScreen();
  // sem aula tocada na agenda, a lista é das aulas recentes
  expect(
    screen.getByRole('header', { name: 'Aulas recentes' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('checkbox', { name: /Quinta, 15 de outubro/ }),
  ).toBeChecked();
});

it('marks an older class from the list', async () => {
  await renderSheet();
  const row = screen.getByRole('checkbox', { name: /Quinta, 8 de outubro/ });
  expect(row).not.toBeChecked();
  expect(within(row).getByText('14:20–16:00 · 2 tempos')).toBeOnTheScreen();
  await userEvent.press(row);
  expect(mockMark).toHaveBeenCalledWith(
    { subjectId: '778', date: '2026-10-08', start: 860, end: 960, slots: 2 },
    true,
  );
});

it('warns when the absence could not be saved', async () => {
  const error = jest.spyOn(snackbar, 'error');
  mockMark.mockResolvedValue(false);
  await renderSheet();
  await userEvent.press(
    screen.getByRole('checkbox', { name: /Quinta, 15 de outubro/ }),
  );
  expect(error).toHaveBeenCalledWith(
    'Não foi possível salvar a falta.',
    'Tente de novo.',
  );
});

it('counts without a limit when the workload is unknown', async () => {
  mockWorkload = null;
  mockFailed = true;
  mockAbsences = [
    { subjectId: '778', date: '2026-10-15', start: 860, end: 960, slots: 2 },
  ];
  await renderSheet();
  expect(screen.getByText('2 tempos')).toBeOnTheScreen();
  expect(
    screen.getByText('Sem a carga horária, não há como saber o limite'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Sem dado')).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Tentar novamente' }),
  );
  expect(mockRetry).toHaveBeenCalled();
});
