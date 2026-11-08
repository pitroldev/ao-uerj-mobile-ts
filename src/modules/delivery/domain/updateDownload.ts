import type { InstallStatus } from './updatePolicy';

export type UpdateDownload =
  | { phase: 'idle'; progress: null }
  | { phase: 'downloading'; progress: number | null }
  | { phase: 'downloaded'; progress: 1 };

export type DownloadEvent =
  | { type: 'accepted' | 'reset' }
  | {
      type: 'progress';
      status: InstallStatus;
      bytesDownloaded: number;
      totalBytes: number;
    };

export const IDLE_DOWNLOAD: UpdateDownload = { phase: 'idle', progress: null };

/** A aceitação só inicia o download; não substitui o progresso que a loja já informou. */
export function updateDownload(
  state: UpdateDownload,
  event: DownloadEvent,
): UpdateDownload {
  switch (event.type) {
    case 'reset':
      return IDLE_DOWNLOAD;
    case 'accepted':
      return state.phase === 'idle'
        ? { phase: 'downloading', progress: null }
        : state;
    case 'progress':
      switch (event.status) {
        case 'downloaded':
          return { phase: 'downloaded', progress: 1 };
        case 'pending':
        case 'downloading': {
          const ratio = event.bytesDownloaded / event.totalBytes;
          return {
            phase: 'downloading',
            progress:
              event.totalBytes > 0 && Number.isFinite(ratio)
                ? Math.max(0, Math.min(1, ratio))
                : null,
          };
        }
        case 'failed':
        case 'canceled':
        case 'installed':
          return IDLE_DOWNLOAD;
        case 'installing':
        case 'unknown':
          return state;
      }
  }
}
