import type {
  AppUpdate,
  InstallStatus,
  UpdateType,
} from '../domain/updatePolicy';

/** Documento do aviso remoto, ainda sem validar. Falha de rede ou tempo esgotado rejeita. */
export interface AppStatusSource {
  fetch(): Promise<unknown>;
}

/** Armazenamento do app inteiro (não por conta): aviso remoto, avaliação, atualização. */
export interface AppKeyValueStore {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}

export type UpdateFlowResult =
  'accepted' | 'canceled' | 'failed' | 'notAllowed';

export type InstallProgress = {
  status: InstallStatus;
  bytesDownloaded: number;
  totalBytes: number;
};

/** Atualização pela loja dentro do app (Play In-App Updates). */
export interface AppUpdatesPort {
  /** `null` quando não há como saber (iOS, app fora da Play, erro). */
  check(): Promise<AppUpdate | null>;
  start(type: UpdateType): Promise<UpdateFlowResult>;
  /** Reinicia o app para instalar a atualização flexível baixada. */
  complete(): Promise<void>;
  onInstallProgress(listener: (progress: InstallProgress) => void): () => void;
}

/** Página do app na loja. */
export interface StoreListingPort {
  readonly available: boolean;
  open(): Promise<void>;
}

/** Pedido de avaliação dentro do app (a loja decide se mostra). */
export interface ReviewPromptPort {
  isAvailable(): boolean;
  request(): Promise<void>;
}
