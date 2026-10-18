import NativeHomeWidget, { type Spec } from '@root/specs/NativeHomeWidget';
import type { WidgetDevicePort } from '@root/modules/widget/application/ports';

/** Widget "Próxima aula" pelo módulo nativo local. `null` no iOS. */
export function createNativeHomeWidget(
  module: Spec | null | undefined = NativeHomeWidget,
): WidgetDevicePort | null {
  if (!module) return null;
  return {
    setSchedule: schedule =>
      module.setSchedule(schedule ? JSON.stringify(schedule) : ''),
  };
}
