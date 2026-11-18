import { AppError } from '@root/shared/errors/AppError';
import type {
  ErrorMonitorPort,
  ErrorReportDraft,
  ErrorReporterPort,
  GeneratorDiagnostic,
  PortalErrors,
} from './ports';
import { sanitizeDescription } from './sanitizeDescription';

type ReporterAccount = { scope: string; name: string; matricula: string };

const GENERATOR_COUNTS = [
  'maximumSubjects',
  'busySlots',
  'saturdayBusySlots',
  'lunchMinutes',
  'chosenSubjects',
  'universalSubjects',
  'eligibleSubjects',
  'refusedSubjects',
  'failedSubjects',
  'classes',
  'freeClasses',
  'subjectsWithFreeClass',
  'removedClasses',
  'schedules',
  'largestSchedule',
] as const satisfies readonly (keyof GeneratorDiagnostic)[];

/** Um código do app: maiúsculas e sublinhado, nunca texto livre. */
const CODE = /^[A-Z_]{1,40}$/;

const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;

/**
 * Só as contagens conhecidas, inteiras e pequenas, e os códigos do resultado
 * e do objetivo: o que mais vier no objeto não sai do aparelho.
 */
function generatorFacts(value: GeneratorDiagnostic): GeneratorDiagnostic {
  const facts: GeneratorDiagnostic = {
    step: isCount(value.step, 20) ? value.step : 0,
    outcome: CODE.test(value.outcome) ? value.outcome : 'UNKNOWN',
  };
  if (typeof value.goal === 'string' && CODE.test(value.goal))
    facts.goal = value.goal;
  GENERATOR_COUNTS.forEach(key => {
    const count = value[key];
    if (isCount(count, 10000)) facts[key] = count;
  });
  return facts;
}

/** O nome de uma leitura do portal ("schedule", "partial-rid"). */
const RESOURCE = /^[a-z][a-z-]{0,39}$/;
const MAX_PORTAL_ERRORS = 12;

/** Só pares de nome e código: o que mais vier não sai do aparelho. */
function portalErrorFacts(value: PortalErrors): PortalErrors | null {
  const facts = Object.entries(value)
    .filter(
      ([resource, code]) =>
        RESOURCE.test(resource) && typeof code === 'string' && CODE.test(code),
    )
    .slice(0, MAX_PORTAL_ERRORS);
  return facts.length ? Object.fromEntries(facts) : null;
}

export class SubmitErrorReport {
  constructor(
    private readonly reporter: ErrorReporterPort,
    private readonly version: {
      appVersion: string;
      parserVersion: string;
      /** A atualização OTA em uso; sem ela, o JS da loja. */
      updateId?: string | null;
    },
    private readonly currentAccount: () => ReporterAccount | null,
    private readonly monitor?: ErrorMonitorPort,
  ) {}

  execute = async (draft: ErrorReportDraft): Promise<void> => {
    const account = this.currentAccount();
    if (!account) throw new AppError('NOT_LOGGED_IN');
    if (!draft.page.trim() || !draft.description.trim())
      throw new AppError('INVALID_INPUT');
    const personalValues = [account.name, account.matricula];
    const operation = sanitizeDescription(draft.page, personalValues).slice(
      0,
      100,
    );
    const description = sanitizeDescription(draft.description, personalValues);
    if (!operation || !description) throw new AppError('INVALID_INPUT');
    const subjectCode = draft.subjectCode?.trim().toUpperCase();
    if (subjectCode && !/^[A-Z][A-Z0-9]{1,7}-\d{3,8}$/.test(subjectCode))
      throw new AppError('INVALID_INPUT');
    const category = draft.category ?? 'USER_REPORT';
    // Antes do envio, para o id ir junto no relato. Uma nova tentativa depois
    // de falha de rede registra outro evento.
    const eventId = this.monitor?.linkReport({ operation, category });
    const { appVersion, parserVersion, updateId } = this.version;
    const portalErrors = draft.portalErrors
      ? portalErrorFacts(draft.portalErrors)
      : null;
    await this.reporter.submit({
      page: operation,
      description,
      diagnostic: {
        schemaVersion: 1,
        operation,
        category,
        appVersion,
        parserVersion,
        ...(updateId ? { updateId } : {}),
        ...(subjectCode ? { subjectCode } : {}),
        ...(eventId ? { eventId } : {}),
        ...(draft.generator
          ? { generator: generatorFacts(draft.generator) }
          : {}),
        ...(portalErrors ? { portalErrors } : {}),
      },
    });
    if (this.currentAccount()?.scope !== account.scope)
      throw new AppError('CANCELLED');
  };
}
