import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Widget "Próxima aula" da tela inicial (só no Android). */
export interface Spec extends TurboModule {
  /**
   * Substitui a grade do widget (JSON de `WidgetSchedule`) e redesenha os
   * widgets na tela; texto vazio o deixa pedindo o login.
   */
  setSchedule(schedule: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('HomeWidget');
