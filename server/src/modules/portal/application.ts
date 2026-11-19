import { systemClock, type Clock } from '../../shared/clock.ts';
import { UnavailableError } from '../../shared/errors.ts';
import type { PushResult, PushSender } from '../../shared/push.ts';
import {
  INITIAL_STATUS,
  isUp,
  nextStatus,
  type PortalStatus,
} from './domain.ts';
import type {
  PortalAlerts,
  PortalProbe,
  PortalPushDeviceRepository,
  PortalWatch,
  ReturnAlertRepository,
} from './ports.ts';
import {
  isQuietTime,
  PORTAL_BACK_TEXT,
  PORTAL_PUSH_TTL_MS,
  PORTAL_WAKE_EXPIRY_MS,
  PORTAL_WAKE_INTERVAL_MS,
  RETURN_ALERT_EXPIRY_MS,
  RETURN_ALERT_TTL_MS,
  type ReturnAlert,
} from './push.ts';

/** Quantos iPhones recebem de uma vez (o aviso de volta e o cutucão). */
const PUSH_BATCH = 20;

const pushUnavailable = () =>
  new UnavailableError(
    'push_unavailable',
    'Notifications to the iPhone are not available right now',
  );

/**
 * Guarda só a situação do portal, atualizada a cada `check`. Quando consultar
 * é de quem chama (no servidor, um agendador em `adapters/inbound`).
 */
export function createPortalWatch({
  probe,
  now = systemClock,
  timeoutMs = 10000,
}: {
  probe: PortalProbe;
  now?: Clock;
  timeoutMs?: number;
}): PortalWatch {
  let status = INITIAL_STATUS;
  let checking: Promise<PortalStatus> | null = null;

  return {
    check() {
      checking ??= probe(timeoutMs)
        .then(
          httpStatus => isUp(httpStatus),
          () => isUp(null),
        )
        .then(up => {
          status = nextStatus(status, up, now());
          return status;
        })
        .finally(() => {
          checking = null;
        });
      return checking;
    },
    snapshot: () => status,
  };
}

/** Em lotes, sem segurar a rodada inteira por um aparelho lento. */
async function inBatches<T>(
  items: readonly T[],
  send: (item: T) => Promise<boolean>,
): Promise<number> {
  let sent = 0;
  for (let start = 0; start < items.length; start += PUSH_BATCH) {
    const results = await Promise.all(
      items.slice(start, start + PUSH_BATCH).map(send),
    );
    sent += results.filter(Boolean).length;
  }
  return sent;
}

/**
 * Os avisos do portal no iPhone, que não testa o portal a cada 15 minutos
 * nem roda a verificação na hora certa (o iOS decide). O servidor testa o
 * portal sozinho (`monitoring`) e nunca tem a senha do aluno:
 *
 * - "Avisar quando voltar": o pedido guarda o token do aparelho, e o primeiro
 *   teste com o portal no ar depois dele manda o aviso, uma vez (das 22h às
 *   7h, espera);
 * - o cutucão: um push silencioso a cada 4 horas, das 7h às 22h, acorda o
 *   app para a verificação, que o próprio celular faz no portal.
 *
 * Sem `push` (a chave do APNs), os dois ficam desligados. Nenhum envio
 * segura quem pediu; a falha vai só para `onPushError`.
 */
export function createPortalAlerts({
  returnAlerts,
  devices,
  push = null,
  monitoring,
  onPushError = () => undefined,
  now = systemClock,
}: {
  returnAlerts: ReturnAlertRepository;
  devices: PortalPushDeviceRepository;
  /** `null`: sem a chave do APNs. */
  push?: PushSender | null;
  /** O servidor testa o portal sozinho (`PORTAL_MONITOR`). */
  monitoring: boolean;
  onPushError?: (err: unknown) => void;
  now?: Clock;
}): PortalAlerts {
  const at = () => new Date(now());
  const returnAvailable = Boolean(push) && monitoring;

  /** O aviso do portal de volta para um pedido; devolve o pedido se não chegou. */
  async function tellBack(alert: ReturnAlert, time: Date) {
    if (!push || !(await returnAlerts.claim(alert))) return false;
    let result: PushResult;
    try {
      result = await push.send(alert.device, {
        ...PORTAL_BACK_TEXT,
        thread: 'portal',
        collapseId: 'portal-back',
        target: 'home',
        expiresAt: new Date(time.getTime() + RETURN_ALERT_EXPIRY_MS),
      });
    } catch (err) {
      onPushError(err);
      result = 'failed';
    }
    // não chegou agora: o pedido volta para o próximo teste; o token que a
    // Apple recusou de vez vai embora com ele
    if (result === 'failed')
      await returnAlerts.restore(alert).catch(onPushError);
    return result === 'sent';
  }

  return {
    async returnAlertStatus({ studentId }) {
      const alert = await returnAlerts.find(studentId, at());
      return { available: returnAvailable, requested: Boolean(alert) };
    },

    async requestReturnAlert(device, { studentId }) {
      if (!returnAvailable) throw pushUnavailable();
      const time = at();
      await returnAlerts.put({
        student: studentId,
        device: { platform: device.platform, token: device.token },
        requestedAt: time,
        expiresAt: new Date(time.getTime() + RETURN_ALERT_TTL_MS),
      });
    },

    async cancelReturnAlert({ studentId }) {
      await returnAlerts.remove(studentId);
    },

    async pushStatus({ studentId }) {
      const entry = await devices.find(studentId, at());
      return { available: Boolean(push), registered: Boolean(entry) };
    },

    async registerPush(device, { studentId }) {
      if (!push) throw pushUnavailable();
      const time = at();
      await devices.put({
        student: studentId,
        device: { platform: device.platform, token: device.token },
        updatedAt: time,
        expiresAt: new Date(time.getTime() + PORTAL_PUSH_TTL_MS),
      });
    },

    async unregisterPush({ studentId }) {
      await devices.remove(studentId);
    },

    async portalChecked(status) {
      if (!push || status.state !== 'up' || status.checkedAt === null) return 0;
      const time = at();
      if (isQuietTime(time)) return 0;
      const pending = await returnAlerts.listRequestedBefore(
        time,
        new Date(status.checkedAt),
      );
      return inBatches(pending, alert => tellBack(alert, time));
    },

    async wakeDevices() {
      if (!push?.wake) return 0;
      const time = at();
      if (isQuietTime(time)) return 0;
      const sender = push;
      const since = new Date(time.getTime() - PORTAL_WAKE_INTERVAL_MS);
      const due = await devices.listWakeable(time, since);
      return inBatches(due, async entry => {
        if (!(await devices.claimWake(entry.student, time, since)))
          return false;
        let result: PushResult;
        try {
          result =
            (await sender.wake?.(entry.device, {
              wake: { portal: 'wake' },
              expiresAt: new Date(time.getTime() + PORTAL_WAKE_EXPIRY_MS),
            })) ?? 'failed';
        } catch (err) {
          onPushError(err);
          result = 'failed';
        }
        if (result === 'gone')
          await devices.forget(entry.student, entry.device.token);
        return result === 'sent';
      });
    },

    async dropStudent(studentId) {
      await returnAlerts.remove(studentId);
      await devices.remove(studentId);
    },
  };
}
