import NativeAppNotifications, {
  type Spec,
} from '@root/specs/NativeAppNotifications';
import type { LaunchSource } from '@root/modules/launch/application/ports';
import { toLaunchTarget } from '@root/modules/launch/domain/launchTarget';

/**
 * Aberturas do app vindas de fora (aviso tocado, atalho do ícone, widget).
 * O módulo nativo dos avisos lê o destino do intent da MainActivity ou, no
 * iOS, o que o AppDelegate guardou (LaunchCenter.swift). `null` onde o módulo
 * não existe.
 */
export function createLaunches(
  module: Spec | null | undefined = NativeAppNotifications,
): LaunchSource | null {
  if (!module) return null;
  const consume = async () =>
    toLaunchTarget(await module.consumeLaunchTarget().catch(() => null));
  return {
    consume,
    subscribe(listener) {
      // o evento só avisa da abertura: o destino sai do intent na primeira
      // leitura, e a mesma abertura não abre a tela duas vezes
      const subscription = module.onOpenTarget(() => {
        void consume().then(target => {
          if (target) listener(target);
        });
      });
      return () => subscription.remove();
    },
  };
}
