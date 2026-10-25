import NativeHomeWidget, { type Spec } from '@root/specs/NativeHomeWidget';
import type { WidgetDevicePort } from '@root/modules/widget/application/ports';

/**
 * Widget "Próxima aula" pelo módulo nativo local (no iOS, a grade vai para o
 * App Group da extensão do widget). `null` onde o módulo não existe.
 */
export function createNativeHomeWidget(
  module: Spec | null | undefined = NativeHomeWidget,
): WidgetDevicePort | null {
  if (!module) return null;
  return {
    setSchedule: schedule =>
      module.setSchedule(schedule ? JSON.stringify(schedule) : ''),
    setSignedIn: () => module.setSignedIn(),
  };
}
