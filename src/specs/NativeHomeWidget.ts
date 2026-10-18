import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Widget "Próxima aula" da tela inicial (só no Android). */
export interface Spec extends TurboModule {
  /**
   * Substitui a grade do widget (JSON de `WidgetSchedule`) e redesenha os
   * widgets na tela; texto vazio (logout) o deixa pedindo o login.
   */
  setSchedule(schedule: string): Promise<void>;
  /**
   * Conta com a grade ainda não lida: o widget deixa de pedir o login e
   * mantém a grade que tiver.
   */
  setSignedIn(): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('HomeWidget');
