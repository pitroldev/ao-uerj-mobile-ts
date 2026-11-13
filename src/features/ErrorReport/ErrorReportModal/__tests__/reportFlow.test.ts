import { INITIAL_REPORT, reportDraft, reportFlow } from '../reportFlow';
import { SUBJECT_PAGE } from '../../reportPages';

it('guards navigation and keeps the same draft through a failed attempt', () => {
  expect(reportFlow(INITIAL_REPORT, { type: 'next' })).toBe(INITIAL_REPORT);
  expect(reportFlow(INITIAL_REPORT, { type: 'submit' })).toBe(INITIAL_REPORT);
  let state = reportFlow(INITIAL_REPORT, {
    type: 'edit',
    field: 'page',
    value: SUBJECT_PAGE,
  });
  expect(reportFlow(state, { type: 'next' })).toBe(state);
  state = reportFlow(state, {
    type: 'edit',
    field: 'subjectCode',
    value: ' ime02-01388 ',
  });
  state = reportFlow(state, { type: 'next' });
  expect(state.phase).toBe('explaining');
  expect(reportFlow(state, { type: 'submit' })).toBe(state);
  state = reportFlow(state, {
    type: 'edit',
    field: 'description',
    value: 'Turmas vazias.',
  });
  const editing = state;
  state = reportFlow(state, { type: 'submit' });
  expect(state.phase).toBe('submitting');
  for (const type of ['back', 'next', 'submit'] as const) {
    expect(reportFlow(state, { type })).toBe(state);
  }
  expect(
    reportFlow(state, { type: 'edit', field: 'description', value: 'Outro' }),
  ).toBe(state);
  expect(reportFlow(state, { type: 'failed' })).toEqual(editing);
  const sent = reportFlow(state, { type: 'sent' });
  expect(sent.phase).toBe('submitted');
  expect(reportFlow(sent, { type: 'submit' })).toBe(sent);
});

it('omits the previous subject code after changing to a different feature', () => {
  const fields = {
    page: SUBJECT_PAGE,
    subjectCode: ' ime02-01388 ',
    description: 'Falha.',
  };
  let state = { ...INITIAL_REPORT, fields };
  expect(reportDraft(state).subjectCode).toBe('IME02-01388');
  state = reportFlow(state, {
    type: 'edit',
    field: 'page',
    value: 'Quadro de Notas',
  });
  expect(reportDraft(state)).toEqual({
    page: 'Quadro de Notas',
    description: 'Falha.',
  });
});

it('carries the generator counts only in a generator report', () => {
  const run = { step: 4, outcome: 'NOT_RUN', busySlots: 10 };
  const state = {
    ...INITIAL_REPORT,
    fields: { page: 'Gerador de Grade', subjectCode: '', description: 'x' },
  };
  expect(reportDraft(state, run)).toEqual({
    page: 'Gerador de Grade',
    description: 'x',
    generator: run,
  });
  expect(reportDraft(state, null)).not.toHaveProperty('generator');
  expect(
    reportDraft(
      reportFlow(state, { type: 'edit', field: 'page', value: 'Sobre' }),
      run,
    ),
  ).not.toHaveProperty('generator');
});
