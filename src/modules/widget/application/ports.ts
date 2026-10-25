import type { WidgetSchedule } from '../domain/nextClassWidget';

/** Widget "Próxima aula" da tela inicial (módulo nativo, Android e iOS). */
export interface WidgetDevicePort {
  /** Substitui a grade do widget; `null` (sem conta) o deixa pedindo o login. */
  setSchedule(schedule: WidgetSchedule | null): Promise<void>;
  /**
   * Há conta, mas a grade ainda não foi lida: o widget deixa de pedir o login
   * (pede para abrir o app) e mantém a grade que tiver.
   */
  setSignedIn(): Promise<void>;
}

export type WidgetAccount = { scope: string; period: string };
