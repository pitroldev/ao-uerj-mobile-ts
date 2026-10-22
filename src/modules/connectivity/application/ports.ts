import type { SharedPortalStatus } from '../domain/sharedStatus';

/** Situação do portal publicada pelo nosso servidor; `null` quando não há. */
export interface SharedPortalStatusPort {
  read(options?: { signal?: AbortSignal }): Promise<SharedPortalStatus | null>;
}
