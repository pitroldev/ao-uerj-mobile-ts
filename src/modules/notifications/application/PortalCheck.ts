import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type {
  ClassGrade,
  EnrollmentResult,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import { SignInError } from '@root/modules/identity/application/ports';
import { AppError, type ErrorCode } from '@root/shared/errors/AppError';
import {
  documentNoticeKey,
  enrollmentChanges,
  expiringDocuments,
  gradeChanges,
  knowEnrollment,
  knowGrades,
  knowRid,
  ridChanges,
  type KnownReadings,
} from '../domain/changes';
import {
  DAILY_INTERVAL,
  DOCUMENT_NOTICE_DAYS,
  isDue,
  isQuietTime,
  normalizeCheckState,
  pauseAfter,
  rememberDocuments,
  type CheckOutcome,
  type CheckState,
} from '../domain/checkState';
import {
  documentMessage,
  enrollmentMessage,
  gradeMessage,
  ridMessage,
  type NotificationContent,
} from '../domain/messages';
import {
  normalizeNotificationPreferences,
  usesPortalChecks,
  type NotificationPreferences,
} from '../domain/preferences';
import { CHECK_STATE_KEY, PREFERENCES_KEY } from './NotificationSettings';
import type {
  AcademicCachePort,
  ActiveAccount,
  NotificationDevicePort,
  NotificationStore,
  RemoteSwitch,
} from './ports';

type Dependencies = {
  records: Pick<
    AcademicRecordsPort,
    'getGrades' | 'getPartialRid' | 'getEnrollmentResult' | 'getSchedule'
  >;
  documents: Pick<DocumentsPort, 'list'>;
  cache: AcademicCachePort;
  device: Pick<NotificationDevicePort, 'notify' | 'permission'>;
  store: NotificationStore;
  account: () => ActiveAccount | null | undefined;
  /** Conta salva no aparelho, lida sem o portal (antes do login). */
  savedScope: () => Promise<string | null>;
  remote: Pick<RemoteSwitch, 'disabled'>;
  now: () => number;
  /** O estado salvo mudou (a tela de Notificações mostra a última verificação). */
  onRecorded?: (scope: string, state: CheckState) => void;
};

export type PortalCheckResult = CheckOutcome | 'skipped';

/** Recusas do portal: a verificação para e só volta depois da pausa. */
const REFUSALS: readonly ErrorCode[] = ['POSSIBLY_BLOCKED', 'RATE_LIMITED'];
/** Portal fora do ar ou sem rede: para agora e tenta no próximo ciclo. */
const UNAVAILABLE: readonly ErrorCode[] = [
  'SERVICE_UNAVAILABLE',
  'ACCOUNT_UNAVAILABLE',
];
const ACCESS: readonly ErrorCode[] = ['LOGIN_FAILED', 'NOT_LOGGED_IN'];
/**
 * Sessão perdida mesmo depois do novo login do adaptador: seguir faria cada
 * página entrar de novo no portal.
 */
const SESSION: readonly ErrorCode[] = ['SESSION_EXPIRED', 'SESSION_CHANGED'];

/**
 * O que para a rodada inteira. `null`: só a página falhou (formato
 * inesperado, página fora do menu) e as outras seguem.
 */
function stopOutcome(code: ErrorCode | null): CheckOutcome | null {
  if (!code) return null;
  if (REFUSALS.includes(code)) return 'blocked';
  if (UNAVAILABLE.includes(code)) return 'unavailable';
  if (code === 'NETWORK') return 'offline';
  if (ACCESS.includes(code)) return 'signed-out';
  if (code === 'CANCELLED' || SESSION.includes(code)) return 'failed';
  return null;
}

/**
 * Login que falhou (o da restauração ou o novo login de uma página): sempre
 * para a rodada, porque a página seguinte entraria de novo. HTTP 4xx ou
 * página de login desconhecida (PORTAL_LAYOUT_CHANGED no login) contam como
 * recusa, com a pausa.
 */
function signInOutcome(code: ErrorCode | null): CheckOutcome {
  if (code === 'PORTAL_LAYOUT_CHANGED') return 'blocked';
  if (code === 'INVALID_INPUT') return 'signed-out';
  return stopOutcome(code) ?? 'failed';
}

type Plan = {
  preferences: NotificationPreferences;
  state: CheckState;
  startedAt: number;
};

class Stop extends Error {
  constructor(readonly outcome: CheckOutcome) {
    super(outcome);
  }
}

/**
 * Verificação em segundo plano (WorkManager → JS sem tela): uma autenticação,
 * só as páginas dos avisos ligados, nada à noite nem durante a pausa depois
 * de uma recusa do portal. Compara com a referência (o que o app já mostrou
 * somado ao que a verificação já leu) e grava a leitura nova no mesmo cache,
 * então a primeira leitura nunca vira aviso.
 */
export class PortalCheck {
  constructor(private readonly dependencies: Dependencies) {}

  /**
   * O que decide a verificação sem acessar o portal: horário, aviso remoto,
   * avisos ligados, pausa e permissão. `null`: não verificar agora.
   */
  private async plan(scope: string): Promise<Plan | null> {
    const { store, remote, device, now } = this.dependencies;
    const startedAt = now();
    if (isQuietTime(startedAt) || remote.disabled()) return null;
    const preferences = normalizeNotificationPreferences(
      await store.read<unknown>(scope, PREFERENCES_KEY).catch(() => null),
    );
    if (!usesPortalChecks(preferences)) return null;
    const state = normalizeCheckState(
      await store.read<unknown>(scope, CHECK_STATE_KEY).catch(() => null),
    );
    if (state.pausedUntil !== null && startedAt < state.pausedUntil)
      return null;
    if ((await device.permission().catch(() => 'denied')) !== 'granted')
      return null;
    return { preferences, state, startedAt };
  }

  /**
   * Antes do login, com a conta salva: à noite, na pausa, com os avisos
   * desligados ou sem permissão, o portal nem é acessado.
   */
  async canRun(): Promise<boolean> {
    const scope = await this.dependencies.savedScope().catch(() => null);
    return scope !== null && (await this.plan(scope)) !== null;
  }

  /**
   * A restauração da conta, que é o login desta rodada, falhou: grava o
   * resultado (com a pausa de uma recusa) sem consultar páginas, que
   * entrariam de novo no portal.
   */
  async signInFailed(code: ErrorCode | null): Promise<PortalCheckResult> {
    const account = this.dependencies.account();
    if (!account) return 'skipped';
    const plan = await this.plan(account.scope);
    if (!plan) return 'skipped';
    return this.finish(
      account,
      plan.state,
      plan.startedAt,
      signInOutcome(code),
    );
  }

  async run(
    options: { signal?: AbortSignal } = {},
  ): Promise<PortalCheckResult> {
    const { account: currentAccount, cache, records } = this.dependencies;
    const account = currentAccount();
    if (!account) return 'skipped';
    const plan = await this.plan(account.scope);
    if (!plan) return 'skipped';
    const { preferences, state, startedAt } = plan;

    const messages: NotificationContent[] = [];
    let next: CheckState = state;
    // a referência vale para o período; a de um aviso desligado é descartada
    const saved = state.known?.period === account.period ? state.known : null;
    let known: KnownReadings = {
      period: account.period,
      grades: preferences.grades ? (saved?.grades ?? {}) : {},
      rid: preferences.rid ? (saved?.rid ?? {}) : {},
      enrollment: preferences.rid ? (saved?.enrollment ?? {}) : {},
    };
    let outcome: CheckOutcome = 'ok';
    const step = async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (error) {
        const code = error instanceof AppError ? error.code : null;
        const stop =
          error instanceof SignInError
            ? signInOutcome(code)
            : stopOutcome(code);
        if (stop) throw new Stop(stop);
        // formato inesperado ou página fora do menu não impedem as outras
        outcome = 'failed';
      }
    };

    // Em cada página: sem leitura anterior no cache, a atual vira referência,
    // sem aviso. Com ela, o que o app mostrou também conta como visto, e a
    // leitura nova soma à referência sem apagar o que estiver em branco.
    try {
      if (preferences.grades)
        await step(async () => {
          const previous = cache.read<ClassGrade[]>(account, 'grades');
          const current = await records.getGrades(options);
          cache.write(account, 'grades', current);
          const seen = previous ? knowGrades(known.grades, previous.data) : {};
          if (previous)
            gradeChanges(seen, current).forEach(change =>
              messages.push(gradeMessage(change, preferences.gradeValues)),
            );
          known = { ...known, grades: knowGrades(seen, current) };
        });
      if (preferences.rid)
        await step(async () => {
          const previous = cache.read<PartialRidResult>(account, 'partial-rid');
          const current = await records.getPartialRid(options);
          cache.write(account, 'partial-rid', current);
          const seen = previous
            ? knowRid(known.rid, previous.data.subjects)
            : {};
          if (previous)
            ridChanges(seen, current.subjects).forEach(change =>
              messages.push(ridMessage(change)),
            );
          known = { ...known, rid: knowRid(seen, current.subjects) };
        });
      if (preferences.rid)
        await step(async () => {
          const previous = cache.read<EnrollmentResult>(
            account,
            'enrollment-result',
          );
          const current = await records.getEnrollmentResult(options);
          cache.write(account, 'enrollment-result', current);
          const seen = previous
            ? knowEnrollment(known.enrollment, previous.data.subjects)
            : {};
          const changes = previous
            ? enrollmentChanges(seen, current.subjects)
            : [];
          if (changes.length)
            messages.push(enrollmentMessage(current.subjects, changes));
          known = {
            ...known,
            enrollment: knowEnrollment(seen, current.subjects),
          };
        });
      // a grade alimenta os lembretes; o cache avisa quem os agenda
      if (
        preferences.classReminders &&
        isDue(
          cache.read(account, 'schedule')?.updatedAt ?? null,
          startedAt,
          DAILY_INTERVAL,
        )
      )
        await step(async () => {
          const current = await records.getSchedule(options);
          cache.write(account, 'schedule', current);
        });
      if (
        preferences.documents &&
        isDue(state.documentsCheckedAt, startedAt, DAILY_INTERVAL)
      )
        await step(async () => {
          const documents = await this.dependencies.documents.list(options);
          const expiring = expiringDocuments(
            documents,
            startedAt,
            DOCUMENT_NOTICE_DAYS,
          ).filter(
            item =>
              !next.notifiedDocuments.includes(
                documentNoticeKey(item.document),
              ),
          );
          expiring.forEach(item => messages.push(documentMessage(item)));
          next = {
            ...next,
            documentsCheckedAt: startedAt,
            notifiedDocuments: rememberDocuments(
              next.notifiedDocuments,
              expiring.map(item => documentNoticeKey(item.document)),
            ),
          };
        });
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      outcome = error.outcome;
    }

    return this.finish(
      account,
      { ...next, known },
      startedAt,
      outcome,
      messages,
    );
  }

  /** Mostra os avisos e grava o resultado, enquanto a conta for a mesma. */
  private async finish(
    account: ActiveAccount,
    state: CheckState,
    startedAt: number,
    outcome: CheckOutcome,
    messages: readonly NotificationContent[] = [],
  ): Promise<PortalCheckResult> {
    const { account: currentAccount, store, device } = this.dependencies;
    // a conta pode sair durante as consultas ou os avisos: o que falta não é
    // avisado nem salvo (o logout já apagou os dados dela)
    const signedIn = () => currentAccount()?.scope === account.scope;
    for (const message of messages) {
      if (!signedIn()) return 'skipped';
      await device.notify(message).catch(() => undefined);
    }
    if (!signedIn()) return 'skipped';
    const next: CheckState = {
      ...state,
      lastRunAt: startedAt,
      lastOutcome: outcome,
      pausedUntil: pauseAfter(outcome, startedAt),
    };
    await store
      .write(account.scope, CHECK_STATE_KEY, next)
      .catch(() => undefined);
    this.dependencies.onRecorded?.(account.scope, next);
    await this.dependencies.cache.flush().catch(() => undefined);
    return outcome;
  }
}
