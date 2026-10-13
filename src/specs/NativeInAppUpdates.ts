import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Estado de uma atualização na Play. Os textos espelham as constantes da
 * Play Core (UpdateAvailability e InstallStatus) em minúsculas.
 */
export type NativeAppUpdateInfo = {
  /** `available`, `notAvailable`, `inProgress` ou `unknown`. */
  availability: string;
  availableVersionCode: number;
  /** Dias desde que a Play soube da versão nova; -1 se ela não informar. */
  stalenessDays: number;
  /** Prioridade de 0 a 5 definida no envio do release. */
  priority: number;
  flexibleAllowed: boolean;
  immediateAllowed: boolean;
  /** `pending`, `downloading`, `downloaded`, `installing`, `installed`, `failed`, `canceled` ou `unknown`. */
  installStatus: string;
};

export type NativeInstallState = {
  installStatus: string;
  bytesDownloaded: number;
  totalBytesToDownload: number;
  errorCode: number;
};

export interface Spec extends TurboModule {
  /** Rejeita quando o app não veio da Play (debug, emulador, outra loja). */
  checkUpdate(): Promise<NativeAppUpdateInfo>;
  /**
   * `flexible` ou `immediate`. Resolve com `accepted`, `canceled`, `failed`
   * ou `notAllowed`.
   */
  startUpdate(type: string): Promise<string>;
  /** Reinicia o app para instalar uma atualização flexível já baixada. */
  completeUpdate(): Promise<void>;
  readonly onInstallState: CodegenTypes.EventEmitter<NativeInstallState>;
}

/** Só existe no Android (módulo local em android/app/.../updates). */
export default TurboModuleRegistry.get<Spec>('InAppUpdates');
