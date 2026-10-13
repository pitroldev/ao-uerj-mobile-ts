import NativeInAppUpdates, {
  type NativeAppUpdateInfo,
  type Spec,
} from '@root/specs/NativeInAppUpdates';
import type {
  AppUpdatesPort,
  UpdateFlowResult,
} from '@root/modules/delivery/application/ports';
import type {
  AppUpdate,
  InstallStatus,
} from '@root/modules/delivery/domain/updatePolicy';

const INSTALL_STATUSES: readonly InstallStatus[] = [
  'pending',
  'downloading',
  'downloaded',
  'installing',
  'installed',
  'failed',
  'canceled',
];
const FLOW_RESULTS: readonly UpdateFlowResult[] = [
  'accepted',
  'canceled',
  'failed',
  'notAllowed',
];

function installStatus(value: string): InstallStatus {
  return INSTALL_STATUSES.includes(value as InstallStatus)
    ? (value as InstallStatus)
    : 'unknown';
}

function toUpdate(info: NativeAppUpdateInfo): AppUpdate {
  return {
    availability:
      info.availability === 'available' || info.availability === 'inProgress'
        ? info.availability
        : 'none',
    versionCode: info.availableVersionCode,
    stalenessDays: info.stalenessDays >= 0 ? info.stalenessDays : null,
    priority: info.priority,
    flexibleAllowed: info.flexibleAllowed,
    immediateAllowed: info.immediateAllowed,
    installStatus: installStatus(info.installStatus),
  };
}

/**
 * Play In-App Updates pelo módulo nativo local. `null` no iOS (o módulo só
 * existe no Android); fora da Play a checagem rejeita e vira "sem atualização".
 */
export function createNativeAppUpdates(
  module: Spec | null | undefined = NativeInAppUpdates,
): AppUpdatesPort | null {
  if (!module) return null;
  return {
    async check() {
      try {
        return toUpdate(await module.checkUpdate());
      } catch {
        return null;
      }
    },
    async start(type) {
      const result = await module.startUpdate(type);
      return FLOW_RESULTS.includes(result as UpdateFlowResult)
        ? (result as UpdateFlowResult)
        : 'failed';
    },
    complete: () => module.completeUpdate(),
    onInstallProgress(listener) {
      const subscription = module.onInstallState(state =>
        listener({
          status: installStatus(state.installStatus),
          bytesDownloaded: state.bytesDownloaded,
          totalBytes: state.totalBytesToDownload,
        }),
      );
      return () => subscription.remove();
    },
  };
}
