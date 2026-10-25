import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import type {
  AttendedClassesSchedule,
  ClassGrade,
} from '@root/modules/academics/domain/models';
import type { Evaluation } from '@root/modules/evaluations/domain/evaluations';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@root/modules/notifications/domain/preferences';
import { renderWithProviders } from '@root/test-utils/render';

import { EvaluationSheet, type EvaluationRequest } from '../EvaluationSheet';

let mockEvaluations: Evaluation[] = [];
const mockSave = jest.fn(async (_evaluation: Evaluation) => true);
const mockRemove = jest.fn(async (_id: string) => true);
jest.mock('@root/modules/evaluations/presentation/useEvaluations', () => ({
  useEvaluations: () => ({
    evaluations: mockEvaluations,
    save: mockSave,
    remove: mockRemove,
    setDone: jest.fn(),
  }),
}));
let mockPreferences: NotificationPreferences;
let mockPermission: string;
const mockSettings = {
  update: jest.fn(async () => 'saved'),
  requestPermission: jest.fn(async () => 'granted'),
  openSettings: jest.fn(async () => undefined),
};
jest.mock(
  '@root/modules/notifications/presentation/useNotificationSettings',
  () => ({
    useNotificationSettings: () => ({
      snapshot: {
        supported: true,
        backgroundChecks: true,
        ready: true,
        preferences: mockPreferences,
        permission: mockPermission,
        exactAlarms: true,
        remoteDisabled: false,
      },
      settings: mockSettings,
    }),
  }),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const info = (id: string, name: string, room: string) => ({
  id,
  name,
  class: '1',
  avaLocation: '',
  uerjLocation: `Pav. João Lyra Filho · ${room}`,
  status: 'ACTIVE',
});
const CALC = info('MAT01-00211', 'Cálculo II', 'Sala 6019 B');
const FIS = info('FIS01-00342', 'Física III', 'Sala 3025 F');
const meeting = (
  item: ReturnType<typeof info>,
  dayNumber: number,
  start: number,
): AttendedClassesSchedule => ({
  class: item,
  dayAlias: '',
  dayNumber,
  subject_id: item.id,
  periodAlias: 'T3',
  startTimeAlias: `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}`,
  endTimeAlias: '',
  start_time_in_minutes: start,
  end_time_in_minutes: start + 100,
});
// Cálculo às segundas e quartas, 14:20; Física às terças e quintas, 8:00
const SCHEDULE = [
  meeting(CALC, 1, 860),
  meeting(CALC, 3, 860),
  meeting(FIS, 2, 480),
  meeting(FIS, 4, 480),
];
const GRADES: ClassGrade[] = [
  { id: CALC.id, name: CALC.name, class: '1', grades: { p1: 6.5 } },
];
/** Segunda, 23/11/2026, 13:05: a aula de Cálculo de hoje ainda vai começar. */
const NOW = new Date(2026, 10, 23, 13, 5);

const existing = (patch: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1',
  subjectId: '211',
  subjectName: 'Cálculo II',
  type: 'P2',
  date: '2026-11-30',
  time: 860,
  note: 'Integrais duplas.',
  reminders: ['eve'],
  earlyTime: 1200,
  dayTime: 420,
  done: false,
  ...patch,
});

/** O estado de um chip (o filtro `checked` da Testing Library não vale para `togglebutton`). */
const chipState = (name: string) =>
  screen.getByRole('togglebutton', { name }).props.accessibilityState;

const onClose = jest.fn();
const renderSheet = (request: EvaluationRequest) =>
  renderWithProviders(
    <EvaluationSheet
      visible
      request={request}
      onClose={onClose}
      schedule={SCHEDULE}
      grades={GRADES}
      now={NOW}
    />,
  );

beforeEach(() => {
  mockEvaluations = [];
  mockPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
  mockPermission = 'granted';
  mockSave.mockClear();
  mockRemove.mockClear();
  onClose.mockClear();
});

it('starts from the next class and drops the default reminders that passed', async () => {
  await renderSheet({ kind: 'new' });
  expect(screen.getByText('Nova avaliação')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Disciplina: Cálculo II. Trocar' }),
  ).toBeOnTheScreen();
  // a P1 de Cálculo saiu: a próxima prova é a P2, hoje às 14:20
  expect(
    screen.getByRole('togglebutton', { name: 'P1: a nota já saiu, 6,5' }),
  ).toBeDisabled();
  expect(chipState('P2')).toMatchObject({ checked: true });
  expect(
    screen.getByText('Segunda, 23 de novembro. Horário da aula de segunda.'),
  ).toBeOnTheScreen();
  // a véspera e o aviso das 7h de uma prova hoje já passaram
  expect(
    screen.getByRole('togglebutton', { name: 'Na véspera: já passou' }),
  ).toBeDisabled();
  expect(
    screen.getByText(/Sem lembretes: a avaliação só aparece/),
  ).toBeOnTheScreen();
});

it('writes down an exam on another subject with the default reminders', async () => {
  const success = jest.spyOn(snackbar, 'success');
  await renderSheet({ kind: 'new' });
  await userEvent.press(
    screen.getByRole('button', { name: 'Disciplina: Cálculo II. Trocar' }),
  );
  await userEvent.press(screen.getByRole('radio', { name: 'Física III' }));
  expect(chipState('P1')).toMatchObject({ checked: true });
  expect(chipState('Terça, 24 de novembro, dia de aula')).toMatchObject({
    checked: true,
  });
  // os padrões voltam: véspera às 20h e no dia às 7h
  expect(
    screen.getByLabelText('Na véspera: Seg, 23/11, 20:00'),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('No dia: Ter, 24/11, 7:00')).toBeOnTheScreen();

  await userEvent.press(
    screen.getByRole('togglebutton', { name: '1 h antes' }),
  );
  await userEvent.type(
    screen.getByLabelText('Observação'),
    'Capítulos 21 a 24.',
  );
  await userEvent.press(screen.getByRole('button', { name: 'Salvar' }));

  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      subjectId: '342',
      subjectName: 'Física III',
      type: 'P1',
      date: '2026-11-24',
      time: 480,
      note: 'Capítulos 21 a 24.',
      reminders: ['eve', 'day', 'h1'],
      done: false,
    }),
  );
  expect(onClose).toHaveBeenCalled();
  expect(success).toHaveBeenCalledWith(
    'Avaliação anotada',
    '3 lembretes; o primeiro chega Seg, 23/11, 20:00.',
  );
  success.mockRestore();
});

it('warns before replacing the same exam and picks another date in the calendar', async () => {
  mockEvaluations = [existing()];
  await renderSheet({ kind: 'new', subjectId: '211', type: 'P2' });
  expect(
    screen.getByText(
      'Já há P2 de Cálculo II anotada para Seg, 30/11. Salvar troca a data.',
    ),
  ).toBeOnTheScreen();

  await userEvent.press(
    screen.getByRole('togglebutton', { name: 'Outra data' }),
  );
  expect(screen.getByText('Novembro de 2026')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));
  await userEvent.press(
    screen.getByRole('button', { name: 'Quinta, 10 de dezembro' }),
  );
  expect(
    screen.getByText(
      'Quinta, 10 de dezembro. Sem aula nesse dia: confira o horário.',
    ),
  ).toBeOnTheScreen();
  // um dia antes de hoje não se escolhe
  await userEvent.press(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(
    screen.getByRole('button', { name: 'Domingo, 22 de novembro' }),
  ).toBeDisabled();
});

it('edits and deletes an evaluation', async () => {
  const success = jest.spyOn(snackbar, 'success');
  mockEvaluations = [existing()];
  await renderSheet({ kind: 'edit', id: 'e1' });
  expect(screen.getByText('Editar avaliação')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Integrais duplas.')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Excluir' }));
  expect(mockRemove).toHaveBeenCalledWith('e1');
  expect(success).toHaveBeenCalledWith(
    'Avaliação excluída',
    'Os lembretes dela também saíram.',
  );
  success.mockRestore();
});

it('asks for the permission when the reminders need it', async () => {
  const success = jest.spyOn(snackbar, 'success');
  mockPermission = 'denied';
  mockSettings.requestPermission.mockResolvedValueOnce('blocked');
  mockEvaluations = [existing({ type: 'work', time: 1439 })];
  await renderSheet({ kind: 'edit', id: 'e1' });
  await userEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockSettings.requestPermission).toHaveBeenCalled();
  expect(success).toHaveBeenCalledWith(
    'Avaliação atualizada',
    expect.stringContaining('Sem a sua permissão, os lembretes não chegam.'),
  );
  success.mockRestore();
});

it('says when the evaluation reminders are off', async () => {
  mockPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    evaluationReminders: false,
  };
  await renderSheet({ kind: 'new', subjectId: '342' });
  expect(
    screen.getByText(
      'Os lembretes de avaliações estão desligados em Notificações.',
    ),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Ligar os lembretes de avaliações' }),
  );
  expect(mockSettings.update).toHaveBeenCalledWith({
    evaluationReminders: true,
  });
});

it('saves the time typed while the field is still focused', async () => {
  mockEvaluations = [existing()];
  await renderSheet({ kind: 'edit', id: 'e1' });
  // no iPhone o teclado numérico não tem "ok": o aluno digita e toca em Salvar
  await fireEvent.changeText(screen.getByLabelText('Horário'), '930');
  await fireEvent.changeText(
    screen.getByLabelText('Horário dos lembretes de dias antes'),
    '21',
  );
  await userEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ time: 570, earlyTime: 1260 }),
  );
});

it('marks the real today in the calendar of a past evaluation', async () => {
  mockEvaluations = [existing({ date: '2026-11-19', type: 'P1' })];
  await renderSheet({ kind: 'edit', id: 'e1' });
  await userEvent.press(
    screen.getByRole('togglebutton', { name: 'Outra data' }),
  );
  expect(
    screen.getByRole('button', {
      name: 'Segunda, 23 de novembro, hoje, dia de aula',
    }),
  ).toBeOnTheScreen();
  // a data anotada, que já passou, aparece escolhida e não se escolhe outra antes de hoje
  expect(
    screen.getByRole('button', { name: 'Quinta, 19 de novembro' }),
  ).toBeDisabled();
});
