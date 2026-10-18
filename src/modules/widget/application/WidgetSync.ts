import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  buildWidgetSchedule,
  type WidgetClassText,
  type WidgetSchedule,
} from '../domain/nextClassWidget';
import type { WidgetAccount, WidgetDevicePort } from './ports';

type Dependencies = {
  /** `null` onde não há widget (iOS): nada acontece. */
  device: WidgetDevicePort | null;
  /** `undefined` enquanto a identidade é restaurada; `null` sem conta. */
  account: () => WidgetAccount | null | undefined;
  subscribeAccount: (listener: () => void) => () => void;
  /** Grade salva da conta (a mesma do Início), com a hora da leitura. */
  schedule: (
    account: WidgetAccount,
  ) => { data: AttendedClassesSchedule[]; updatedAt: number } | null;
  text: (item: AttendedClassesSchedule) => WidgetClassText;
};

/** Conta sem grade lida (`WidgetDevicePort.setSignedIn`). */
const SIGNED_IN = 'signed-in';

/**
 * Leva ao widget "Próxima aula" a grade salva da conta ativa sempre que ela
 * muda. Sem conta (logout), o widget é limpo e passa a pedir o login. Com
 * conta e a grade ainda não lida (o login limpa o widget, e o portal pode
 * falhar logo depois), ele deixa de pedir o login e mantém a grade que
 * tiver. Enquanto a conta é restaurada, fica como estava.
 */
export class WidgetSync {
  /** O que já está no aparelho neste runtime (`null`: ainda não enviado). */
  private applied: string | null = null;
  private syncing: Promise<void> = Promise.resolve();
  private started = false;

  constructor(private readonly dependencies: Dependencies) {}

  /** Acompanha a conta. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.dependencies.subscribeAccount(() => {
      void this.sync();
    });
    void this.sync();
  }

  /** A grade salva mudou (tela, cache restaurado ou verificação). */
  scheduleChanged(): Promise<void> {
    return this.sync();
  }

  private sync(): Promise<void> {
    const { device } = this.dependencies;
    if (!device) return Promise.resolve();
    const task = this.syncing.then(async () => {
      const account = this.dependencies.account();
      if (account === undefined) return;
      let next: WidgetSchedule | typeof SIGNED_IN | null = null;
      if (account) {
        const saved = this.dependencies.schedule(account);
        next = saved
          ? buildWidgetSchedule(saved.data, {
              fetchedAt: saved.updatedAt,
              text: this.dependencies.text,
            })
          : SIGNED_IN;
      }
      const json = JSON.stringify(next);
      if (json === this.applied) return;
      this.applied = json;
      const sent =
        next === SIGNED_IN ? device.setSignedIn() : device.setSchedule(next);
      // uma falha tenta de novo na próxima mudança
      await sent.catch(() => {
        this.applied = null;
      });
    });
    this.syncing = task.catch(() => undefined);
    return task;
  }
}
