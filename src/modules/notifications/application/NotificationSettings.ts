import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  buildReminderPlan,
  type ReminderPlan,
  type ReminderText,
} from '../domain/classReminders';
import {
  CHECK_INTERVAL_HOURS,
  EMPTY_CHECK_STATE,
  normalizeCheckState,
  type CheckState,
} from '../domain/checkState';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  usesPortalChecks,
  type NotificationPreferences,
} from '../domain/preferences';
import type {
  ActiveAccount,
  NotificationDevicePort,
  NotificationStore,
  PermissionState,
  RemoteSwitch,
} from './ports';

export const PREFERENCES_KEY = 'notifications';
export const CHECK_STATE_KEY = 'notifications-check';

export type NotificationsSnapshot = {
  /** O aparelho tem os recursos (só no Android). */
  supported: boolean;
  /** Preferências da conta ativa já lidas. */
  ready: boolean;
  preferences: NotificationPreferences;
  /** `null` antes da primeira consulta ao sistema. */
  permission: PermissionState | null;
  /** Lembrete no horário exato; `null` antes da consulta. */
  exactAlarms: boolean | null;
  /** Desligado pelo aviso remoto. */
  remoteDisabled: boolean;
  check: CheckState;
};

/** Resultado de uma escolha que pede permissão ao sistema. */
export type UpdateResult = 'saved' | PermissionState;

type Dependencies = {
  /** `null` onde não há suporte (iOS): tudo fica inerte. */
  device: NotificationDevicePort | null;
  store: NotificationStore;
  /** `undefined` enquanto a identidade é restaurada; `null` sem conta. */
  account: () => ActiveAccount | null | undefined;
  subscribeAccount: (listener: () => void) => () => void;
  remote: RemoteSwitch;
  /** Grade salva da conta (a mesma do Início), com a hora da leitura. */
  schedule: (
    account: ActiveAccount,
  ) => { data: AttendedClassesSchedule[]; updatedAt: number } | null;
  reminderText: (item: AttendedClassesSchedule) => ReminderText;
};

/**
 * O que deve estar agendado no aparelho. `plan` `undefined`: a grade salva
 * não está disponível, e o plano que já está no aparelho continua.
 */
type Desired = { plan: ReminderPlan | null | undefined; portal: boolean };

const ENABLING_KEYS = ['classReminders', 'grades', 'rid', 'documents'] as const;

/**
 * Preferências de aviso da conta ativa e o que fica agendado no aparelho:
 * lembretes de aula (grade salva) e verificação periódica no portal. Só
 * agenda com conta, permissão do sistema e sem desligamento remoto; o logout,
 * a troca de conta e a permissão retirada cancelam tudo.
 */
export class NotificationSettings {
  private snapshot: NotificationsSnapshot;
  private listeners = new Set<() => void>();
  private scope: string | null = null;
  /** A conta já foi conhecida uma vez (com ou sem login). */
  private settled = false;
  private generation = 0;
  private started = false;
  /** O que já está no aparelho neste runtime (`null`: ainda não enviado). */
  private appliedPlan: string | null = null;
  private appliedPortal: boolean | null = null;
  private applying: Promise<void> = Promise.resolve();
  /** As escolhas são salvas uma de cada vez: a segunda parte da primeira. */
  private updating: Promise<unknown> = Promise.resolve();
  /** A leitura das preferências falhou: a volta ao app tenta de novo. */
  private loadFailed = false;

  constructor(private readonly dependencies: Dependencies) {
    this.snapshot = {
      supported: dependencies.device !== null,
      ready: false,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      permission: null,
      exactAlarms: null,
      remoteDisabled: dependencies.remote.disabled(),
      check: EMPTY_CHECK_STATE,
    };
  }

  getSnapshot = (): NotificationsSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(patch: Partial<NotificationsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  /** Acompanha a conta e o desligamento remoto. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.dependencies.subscribeAccount(() => {
      void this.accountChanged();
    });
    this.dependencies.remote.subscribe(() => {
      const remoteDisabled = this.dependencies.remote.disabled();
      if (remoteDisabled === this.snapshot.remoteDisabled) return;
      this.publish({ remoteDisabled });
      void this.apply();
    });
    if (this.snapshot.remoteDisabled) void this.apply();
    void this.accountChanged();
  }

  private async accountChanged() {
    const account = this.dependencies.account();
    // Na abertura a conta ainda é desconhecida: nada é cancelado até saber.
    if (account === undefined) return;
    const scope = account?.scope ?? null;
    if (scope === this.scope && (scope !== null || this.settled)) return;
    const previous = this.scope;
    const first = !this.settled;
    this.settled = true;
    this.scope = scope;
    const generation = ++this.generation;
    // logout, troca de conta ou conta recusada na restauração (num runtime
    // novo não há conta anterior): os avisos e os lembretes saem do aparelho,
    // antes do plano da conta nova
    if (previous !== null || (first && scope === null)) this.clearDevice();
    this.publish({
      ready: false,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      check: EMPTY_CHECK_STATE,
    });
    if (!scope) {
      await this.apply();
      return;
    }
    await this.load(scope, generation);
  }

  /**
   * Tira os avisos da barra; o aparelho também cancela os lembretes, então o
   * plano da próxima conta vai de novo mesmo que seja igual ao anterior.
   */
  private clearDevice() {
    const { device } = this.dependencies;
    if (!device) return;
    this.appliedPlan = null;
    void device.clearPosted().catch(() => undefined);
  }

  /**
   * Lê as escolhas da conta. Se a leitura falha, a tela segue sem `ready` e o
   * aparelho fica como estava: tratar a falha como "tudo desligado"
   * cancelaria os lembretes e a próxima escolha apagaria as outras.
   */
  private async load(scope: string, generation: number) {
    const { store } = this.dependencies;
    this.loadFailed = false;
    let preferences: unknown;
    try {
      preferences = await store.read<unknown>(scope, PREFERENCES_KEY);
    } catch {
      if (generation === this.generation) this.loadFailed = true;
      return;
    }
    const check = await store
      .read<unknown>(scope, CHECK_STATE_KEY)
      .catch(() => null);
    if (generation !== this.generation) return;
    this.publish({
      ready: true,
      preferences: normalizeNotificationPreferences(preferences),
      check: normalizeCheckState(check),
    });
    await this.refreshDevice();
  }

  /** Relê permissão e alarmes exatos (o aluno pode mudar nas configurações). */
  async refreshDevice(): Promise<void> {
    const { device } = this.dependencies;
    if (!device) return;
    if (this.scope && this.loadFailed) {
      await this.load(this.scope, this.generation);
      return;
    }
    const [reported, exactAlarms] = await Promise.all([
      device.permission().catch(() => 'denied' as const),
      device.exactAlarmsAllowed().catch(() => false),
    ]);
    // o sistema só informa se os avisos estão liberados: a recusa definitiva
    // vista no diálogo vale até o aluno liberar nas configurações
    const permission =
      reported === 'denied' && this.snapshot.permission === 'blocked'
        ? 'blocked'
        : reported;
    if (
      permission !== this.snapshot.permission ||
      exactAlarms !== this.snapshot.exactAlarms
    )
      this.publish({ permission, exactAlarms });
    await this.apply();
  }

  /**
   * Salva a escolha. Ligar um aviso sem a permissão do sistema pede a
   * permissão antes; recusada, nada muda e o resultado diz por quê. Escolhas
   * feitas em sequência rápida são salvas uma de cada vez, sem que a segunda
   * desfaça a primeira.
   */
  update(patch: Partial<NotificationPreferences>): Promise<UpdateResult> {
    const task = this.updating.then(() => this.save(patch));
    this.updating = task.catch(() => undefined);
    return task;
  }

  private async save(
    patch: Partial<NotificationPreferences>,
  ): Promise<UpdateResult> {
    const scope = this.scope;
    if (!scope || !this.snapshot.ready) return 'denied';
    const enabling = ENABLING_KEYS.some(
      key => patch[key] === true && !this.snapshot.preferences[key],
    );
    if (enabling && this.snapshot.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') return permission;
    }
    if (scope !== this.scope) return 'denied';
    // parte do estado mais recente: outra escolha pode ter sido salva durante
    // o pedido de permissão
    const next = normalizeNotificationPreferences({
      ...this.snapshot.preferences,
      ...patch,
    });
    await this.dependencies.store.write(scope, PREFERENCES_KEY, next);
    if (scope !== this.scope) return 'denied';
    this.publish({ preferences: next });
    await this.apply();
    return 'saved';
  }

  /** Convite do Início: responde uma vez (ativar ou "agora não"). */
  async answerPrompt(enable: boolean): Promise<UpdateResult> {
    const result = await this.update({ promptAnswered: true });
    if (!enable || result !== 'saved') return result;
    return this.update({ classReminders: true });
  }

  async requestPermission(): Promise<PermissionState> {
    const { device } = this.dependencies;
    if (!device) return 'blocked';
    const permission = await device
      .requestPermission()
      .catch(() => 'denied' as const);
    this.publish({ permission });
    await this.apply();
    return permission;
  }

  openSettings(): Promise<void> {
    return this.dependencies.device?.openSettings() ?? Promise.resolve();
  }

  openExactAlarmSettings(): Promise<void> {
    return (
      this.dependencies.device?.openExactAlarmSettings() ?? Promise.resolve()
    );
  }

  /** A grade salva mudou (app ou verificação): refaz os lembretes. */
  scheduleChanged(): Promise<void> {
    return this.apply();
  }

  /** A verificação em segundo plano registrou um resultado. */
  checkRecorded(scope: string, check: CheckState) {
    if (scope === this.scope) this.publish({ check });
  }

  private desired(account: ActiveAccount | null): Desired {
    const { permission, remoteDisabled, preferences } = this.snapshot;
    if (!account || permission !== 'granted' || remoteDisabled)
      return { plan: null, portal: false };
    const portal = usesPortalChecks(preferences);
    if (!preferences.classReminders) return { plan: null, portal };
    const schedule = this.dependencies.schedule(account);
    // sem a grade salva (o cache em disco dura menos que os lembretes, ou o
    // app abriu sem rede), os lembretes agendados seguem até a validade deles
    if (!schedule) return { plan: undefined, portal };
    return {
      plan: buildReminderPlan(schedule.data, {
        leadMinutes: preferences.reminderLead,
        fetchedAt: schedule.updatedAt,
        text: this.dependencies.reminderText,
      }),
      portal,
    };
  }

  /**
   * Leva o estado desejado ao aparelho, em fila e só quando muda. Enquanto a
   * conta, as preferências ou a permissão não são conhecidas, mantém o que já
   * estava agendado (a abertura do app não reinicia nada). O desligamento
   * remoto não espera: cancelar não depende da conta, e a tarefa sem tela
   * termina sem restaurá-la.
   */
  private apply(): Promise<void> {
    const { device } = this.dependencies;
    if (!device) return Promise.resolve();
    const task = this.applying.then(async () => {
      const account = this.dependencies.account();
      if (!this.snapshot.remoteDisabled) {
        if (account === undefined || !this.settled) return;
        if (
          account &&
          (account.scope !== this.scope ||
            !this.snapshot.ready ||
            this.snapshot.permission === null)
        )
          return;
      }
      const desired = this.desired(account ?? null);
      // cada parte só vai ao aparelho quando muda; uma falha tenta de novo
      // na próxima mudança
      if (desired.plan !== undefined) {
        const plan = JSON.stringify(desired.plan);
        if (plan !== this.appliedPlan) {
          this.appliedPlan = plan;
          await device.setClassReminders(desired.plan).catch(() => {
            this.appliedPlan = null;
          });
        }
      }
      if (desired.portal !== this.appliedPortal) {
        this.appliedPortal = desired.portal;
        await device
          .setPortalCheck(desired.portal, CHECK_INTERVAL_HOURS)
          .catch(() => {
            this.appliedPortal = null;
          });
      }
    });
    this.applying = task.catch(() => undefined);
    return task;
  }
}
