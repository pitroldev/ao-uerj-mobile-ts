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
