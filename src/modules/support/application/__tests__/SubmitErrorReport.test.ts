import type { ErrorMonitorPort, ErrorReporterPort } from '../ports';
import { SubmitErrorReport } from '../SubmitErrorReport';

const account = {
  scope: 'account-a',
  name: 'Estudante Fictício',
  matricula: '209912345678',
};
const version = { appVersion: '1.3.5', parserVersion: '2' };
const draft = {
  page: 'Quadro de Notas',
  description: `Sou ${account.name}, matrícula ${account.matricula}, e minha nota 9,5 sumiu.`,
};

function setup(eventId: string | null = 'evento-1') {
  const reporter: jest.Mocked<ErrorReporterPort> = {
    submit: jest.fn().mockResolvedValue(undefined),
  };
  const monitor: jest.Mocked<ErrorMonitorPort> = {
    linkReport: jest.fn().mockReturnValue(eventId),
  };
  const support = new SubmitErrorReport(
    reporter,
    version,
    () => account,
    monitor,
  );
  return { reporter, monitor, support };
}

it('links the report to the monitoring event and sends it only the screen and category', async () => {
  const { reporter, monitor, support } = setup();
  await support.execute(draft);
  expect(monitor.linkReport).toHaveBeenCalledWith({
    operation: 'Quadro de Notas',
    category: 'USER_REPORT',
  });
  expect(reporter.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      diagnostic: expect.objectContaining({ eventId: 'evento-1' }),
    }),
  );
});

it('omits the event id when monitoring is off or absent', async () => {
  const off = setup(null);
  await off.support.execute(draft);
  expect(off.reporter.submit.mock.calls[0][0].diagnostic).not.toHaveProperty(
    'eventId',
  );

  const reporter: ErrorReporterPort = {
    submit: jest.fn().mockResolvedValue(undefined),
  };
  await new SubmitErrorReport(reporter, version, () => account).execute(draft);
  expect(reporter.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      diagnostic: expect.not.objectContaining({ eventId: expect.anything() }),
    }),
  );
});

it('does not record invalid reports', async () => {
  const { monitor, support } = setup();
  await expect(
    support.execute({ page: 'Quadro de Notas', description: '   ' }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(monitor.linkReport).not.toHaveBeenCalled();
});

it('sends only the known generator counts, as small whole numbers, and an upper-case outcome', async () => {
  const { reporter, support } = setup();
  await support.execute({
    page: 'Gerador de Grade',
    description: 'Não gera com 6 disciplinas.',
    generator: {
      step: 2,
      outcome: 'SHORTFALL_ROUTINE',
      goal: 'COMPACT',
      busySlots: 72,
      saturdayBusySlots: 12,
      lunchMinutes: 50,
      subjectsWithFreeClass: 1,
      classes: 7,
      freeClasses: -1,
      schedules: 1.5,
      largestSchedule: Number.NaN,
      // nada fora da lista sai do aparelho, nem um campo a mais
      ...({
        subjects: ['FFP04-09770'],
        matricula: account.matricula,
      } as object),
    },
  });
  expect(reporter.submit.mock.calls[0][0].diagnostic.generator).toStrictEqual({
    step: 2,
    outcome: 'SHORTFALL_ROUTINE',
    goal: 'COMPACT',
    busySlots: 72,
    saturdayBusySlots: 12,
    lunchMinutes: 50,
    subjectsWithFreeClass: 1,
    classes: 7,
  });
});

it('replaces an outcome that is not a code and leaves other reports without generator counts', async () => {
  const { reporter, support } = setup();
  await support.execute({
    page: 'Gerador de Grade',
    description: 'Erro.',
    generator: { step: 99, outcome: 'falhou para Fulano', goal: 'meu jeito' },
  });
  expect(reporter.submit.mock.calls[0][0].diagnostic.generator).toStrictEqual({
    step: 0,
    outcome: 'UNKNOWN',
  });

  await support.execute(draft);
  expect(reporter.submit.mock.calls[1][0].diagnostic).not.toHaveProperty(
    'generator',
  );
});

it('sends the running OTA update with the app version, and nothing when it runs the store code', async () => {
  const reporter: jest.Mocked<ErrorReporterPort> = {
    submit: jest.fn().mockResolvedValue(undefined),
  };
  const ota = { ...version, updateId: '0195f2a1-7c1e-7d3a-9b2f-1a2b3c4d5e6f' };
  await new SubmitErrorReport(reporter, ota, () => account).execute(draft);
  expect(reporter.submit.mock.calls[0][0].diagnostic).toMatchObject({
    appVersion: '1.3.5',
    updateId: ota.updateId,
  });

  await new SubmitErrorReport(
    reporter,
    { ...version, updateId: null },
    () => account,
  ).execute(draft);
  expect(reporter.submit.mock.calls[1][0].diagnostic).not.toHaveProperty(
    'updateId',
  );
});
