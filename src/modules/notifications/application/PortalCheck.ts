import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type {
  ClassGrade,
  EnrollmentResult,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import {
  documentNoticeKey,
  enrollmentChanges,
  expiringDocuments,
  gradeChanges,
  ridChanges,
} from '../domain/changes';
import {
  DAILY_INTERVAL,
  DOCUMENT_NOTICE_DAYS,
  PAUSE_AFTER_REFUSAL,
  isDue,
  isQuietTime,
  normalizeCheckState,
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
const REFUSALS = ['POSSIBLY_BLOCKED', 'RATE_LIMITED'];
/** Portal fora do ar ou sem rede: para agora e tenta no próximo ciclo. */
const UNAVAILABLE = ['SERVICE_UNAVAILABLE', 'ACCOUNT_UNAVAILABLE'];
const ACCESS = ['LOGIN_FAILED', 'NOT_LOGGED_IN'];
/**
 * Sessão perdida mesmo depois do novo login do adaptador: seguir faria cada
 * página entrar de novo no portal.
 */
const SESSION = ['SESSION_EXPIRED', 'SESSION_CHANGED'];

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
 * de uma recusa do portal. Compara com o que o app já mostrou e grava a
 * leitura nova no mesmo cache, então a primeira leitura nunca vira aviso.
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

  async run(
    options: { signal?: AbortSignal } = {},
  ): Promise<PortalCheckResult> {
    const { account: currentAccount, store, device } = this.dependencies;
    const account = currentAccount();
    if (!account) return 'skipped';
    const plan = await this.plan(account.scope);
    if (!plan) return 'skipped';
    const { preferences, state, startedAt } = plan;

    const messages: NotificationContent[] = [];
    let next: CheckState = { ...state, pausedUntil: null };
    let outcome: CheckOutcome = 'ok';
    const step = async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (error) {
        const code = error instanceof AppError ? error.code : null;
        if (code && REFUSALS.includes(code)) throw new Stop('blocked');
        if (code && UNAVAILABLE.includes(code)) throw new Stop('unavailable');
        if (code === 'NETWORK') throw new Stop('offline');
        if (code === 'CANCELLED') throw new Stop('failed');
        if (code && ACCESS.includes(code)) throw new Stop('signed-out');
        if (code && SESSION.includes(code)) throw new Stop('failed');
        // formato inesperado numa página não impede as outras
        outcome = 'failed';
      }
    };

    try {
      if (preferences.grades)
        await step(async () => {
          const previous = this.dependencies.cache.read<ClassGrade[]>(
            account,
            'grades',
          );
          const current = await this.dependencies.records.getGrades(options);
          this.dependencies.cache.write(account, 'grades', current);
          if (previous)
            gradeChanges(previous.data, current).forEach(change =>
              messages.push(gradeMessage(change, preferences.gradeValues)),
            );
        });
      if (preferences.rid)
        await step(async () => {
          const previous = this.dependencies.cache.read<PartialRidResult>(
            account,
            'partial-rid',
          );
          const current =
            await this.dependencies.records.getPartialRid(options);
          this.dependencies.cache.write(account, 'partial-rid', current);
          if (previous)
            ridChanges(previous.data.subjects, current.subjects).forEach(
              change => messages.push(ridMessage(change)),
            );
        });
      if (preferences.rid)
        await step(async () => {
          const previous = this.dependencies.cache.read<EnrollmentResult>(
            account,
            'enrollment-result',
          );
          const current =
            await this.dependencies.records.getEnrollmentResult(options);
          this.dependencies.cache.write(account, 'enrollment-result', current);
          const changes = previous
            ? enrollmentChanges(previous.data.subjects, current.subjects)
            : [];
          if (changes.length)
            messages.push(enrollmentMessage(current.subjects, changes));
        });
      // a grade alimenta os lembretes; o cache avisa quem os agenda
      if (
        preferences.classReminders &&
        isDue(
          this.dependencies.cache.read(account, 'schedule')?.updatedAt ?? null,
          startedAt,
          DAILY_INTERVAL,
        )
      )
        await step(async () => {
          const current = await this.dependencies.records.getSchedule(options);
          this.dependencies.cache.write(account, 'schedule', current);
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
      if (outcome === 'blocked')
        next = { ...next, pausedUntil: startedAt + PAUSE_AFTER_REFUSAL };
    }

    // a conta pode sair durante as consultas ou os avisos: o que falta não é
    // avisado nem salvo (o logout já apagou os dados dela)
    const signedIn = () => currentAccount()?.scope === account.scope;
    for (const message of messages) {
      if (!signedIn()) return 'skipped';
      await device.notify(message).catch(() => undefined);
    }
    if (!signedIn()) return 'skipped';
    next = { ...next, lastRunAt: startedAt, lastOutcome: outcome };
    await store
      .write(account.scope, CHECK_STATE_KEY, next)
      .catch(() => undefined);
    this.dependencies.onRecorded?.(account.scope, next);
    await this.dependencies.cache.flush().catch(() => undefined);
    return outcome;
  }
}
