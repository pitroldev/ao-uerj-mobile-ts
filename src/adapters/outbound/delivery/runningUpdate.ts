import * as Updates from 'expo-updates';
import type { RunningUpdate } from '@root/modules/delivery/application/ports';

/** O que o app lê do expo-updates (constantes do processo). */
export type UpdatesConstants = Pick<
  typeof Updates,
  'isEnabled' | 'isEmbeddedLaunch' | 'updateId' | 'createdAt'
>;

/**
 * A atualização OTA em uso. `null` com o JS que veio na instalação, com o
 * expo-updates desligado (debug, com o Metro) e na volta de emergência ao JS
 * da instalação depois de uma falha. A escolha vale para o processo inteiro:
 * uma atualização baixada agora só entra na próxima abertura.
 */
export function readRunningUpdate(
  updates: UpdatesConstants = Updates,
): RunningUpdate | null {
  if (!updates.isEnabled || updates.isEmbeddedLaunch) return null;
  if (!updates.updateId || !updates.createdAt) return null;
  return { id: updates.updateId, createdAt: updates.createdAt };
}
