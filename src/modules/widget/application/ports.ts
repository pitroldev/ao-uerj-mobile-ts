import type { WidgetSchedule } from '../domain/nextClassWidget';

/** Widget "Próxima aula" da tela inicial (módulo nativo, só no Android). */
export interface WidgetDevicePort {
  /** Substitui a grade do widget; `null` o deixa pedindo o login. */
  setSchedule(schedule: WidgetSchedule | null): Promise<void>;
}

export type WidgetAccount = { scope: string; period: string };
