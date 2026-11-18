import type {
  ErrorMonitorPort,
  ErrorReporterPort,
  PortalPagesPort,
} from '../ports';
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

it('sends the portal reads that failed only as read names and error codes', async () => {
  const { reporter, support } = setup();
  await support.execute({
    ...draft,
    portalErrors: {
      schedule: 'PORTAL_LAYOUT_CHANGED',
      'partial-rid': 'NETWORK',
      // nem texto livre nem um nome fora do formato saem do aparelho
      grades: `falhou para ${account.name}`,
      [account.matricula]: 'NETWORK',
    },
  });
  expect(
    reporter.submit.mock.calls[0][0].diagnostic.portalErrors,
  ).toStrictEqual({
    schedule: 'PORTAL_LAYOUT_CHANGED',
    'partial-rid': 'NETWORK',
  });

  await support.execute({ ...draft, portalErrors: { grades: 'falhou' } });
  await support.execute(draft);
  for (const call of reporter.submit.mock.calls.slice(1))
    expect(call[0].diagnostic).not.toHaveProperty('portalErrors');
});

describe('the portal pages of a report', () => {
  function withPages(capture: PortalPagesPort['capture']) {
    const reporter: jest.Mocked<ErrorReporterPort> = {
      submit: jest.fn().mockResolvedValue(undefined),
    };
    let current: typeof account | null = account;
    const pages = { capture: jest.fn(capture) };
    const support = new SubmitErrorReport(
      reporter,
      version,
      () => current,
      undefined,
      pages,
    );
    return {
      reporter,
      pages,
      support,
      switchAccount: () => {
        current = { ...account, scope: 'account-b' };
      },
    };
  }

  it('attaches the captured pages after the diagnostic, with the reads that failed', async () => {
    const { reporter, pages, support } = withPages(async () => ({
      pages: [{ read: 'schedule', html: '<p>página anonimizada</p>' }],
      failures: { grades: 'PORTAL_UNSTABLE', history: 'texto livre' },
    }));
    await support.execute({
      ...draft,
      subjectCode: 'ime02-10838',
      pageReads: [
        'schedule',
        'grades',
        'schedule',
        'Fora do Formato',
        'curriculum',
        'history',
      ],
    });
    expect(pages.capture).toHaveBeenCalledWith(
      ['schedule', 'grades', 'curriculum'],
      {
        personal: [account.name, account.matricula],
        subjectCode: 'IME02-10838',
        signal: expect.any(AbortSignal),
      },
    );
    const [report] = reporter.submit.mock.calls[0];
    expect(report.attachments).toEqual(['<p>página anonimizada</p>']);
    expect(report.diagnostic).toMatchObject({
      pages: ['schedule'],
      pageErrors: { grades: 'PORTAL_UNSTABLE' },
    });
  });

  it('still sends the report when the pages do not come', async () => {
    const { reporter, support } = withPages(async () => {
      throw new Error('portal fora');
    });
    await support.execute({ ...draft, pageReads: ['schedule'] });
    const [report] = reporter.submit.mock.calls[0];
    expect(report).not.toHaveProperty('attachments');
    expect(report.diagnostic.pageErrors).toEqual({ schedule: 'UNKNOWN' });
  });

  it('asks for no page when the student turned it off or the screen has none', async () => {
    const { pages, reporter, support } = withPages(async () => ({
      pages: [],
      failures: {},
    }));
    await support.execute(draft);
    await support.execute({ ...draft, pageReads: [] });
    expect(pages.capture).not.toHaveBeenCalled();
    for (const [report] of reporter.submit.mock.calls) {
      expect(report).not.toHaveProperty('attachments');
      expect(report.diagnostic).not.toHaveProperty('pages');
      expect(report.diagnostic).not.toHaveProperty('pageErrors');
    }
  });

  it('does not send the pages of one account in the name of another', async () => {
    const holder: { switchAccount?: () => void } = {};
    const { reporter, support, switchAccount } = withPages(async () => {
      holder.switchAccount?.();
      return { pages: [{ read: 'schedule', html: '<p>x</p>' }], failures: {} };
    });
    holder.switchAccount = switchAccount;
    await expect(
      support.execute({ ...draft, pageReads: ['schedule'] }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(reporter.submit).not.toHaveBeenCalled();
  });
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
