import type {
  PortalPushDeviceRepository,
  ReturnAlertRepository,
} from '../../../modules/portal/ports.ts';
import type {
  PortalPushDevice,
  ReturnAlert,
} from '../../../modules/portal/push.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

/** O pedido de "Avisar quando voltar" no banco: o aluno no `_id`. */
type ReturnAlertDoc = {
  _id: string;
  platform: 'ios';
  token: string;
  requestedAt: Date;
  expiresAt: Date;
};

const toReturnAlert = (doc: ReturnAlertDoc): ReturnAlert => ({
  student: doc._id,
  device: { platform: doc.platform, token: doc.token },
  requestedAt: doc.requestedAt,
  expiresAt: doc.expiresAt,
});

const toReturnAlertDoc = (alert: ReturnAlert): ReturnAlertDoc => ({
  _id: alert.student,
  platform: alert.device.platform,
  token: alert.device.token,
  requestedAt: alert.requestedAt,
  expiresAt: alert.expiresAt,
});

/**
 * Os pedidos de "Avisar quando voltar", um por aluno e um dono por token. O
 * índice TTL apaga os vencidos; até ele passar, as consultas os ignoram.
 */
export function createReturnAlertRepository(
  model: Models['portalReturnAlerts'],
): ReturnAlertRepository {
  return {
    find: (student, now) =>
      guarded(async () => {
        const doc = await model
          .findOne({ _id: student, expiresAt: { $gt: now } })
          .lean<ReturnAlertDoc>();
        return doc ? toReturnAlert(doc) : null;
      }),
    put: alert =>
      guarded(async () => {
        // o mesmo aparelho com outra conta: a anterior não recebe mais
        await model.deleteMany({
          token: alert.device.token,
          _id: { $ne: alert.student },
        });
        const { _id, ...fields } = toReturnAlertDoc(alert);
        await model.replaceOne({ _id }, fields, { upsert: true });
      }),
    remove: student =>
      guarded(async () => {
        await model.deleteOne({ _id: student });
      }),
    listRequestedBefore: (now, before) =>
      guarded(async () => {
        const docs = await model
          .find({ expiresAt: { $gt: now }, requestedAt: { $lt: before } })
          .lean<ReturnAlertDoc[]>();
        return docs.map(toReturnAlert);
      }),
    claim: alert =>
      guarded(async () => {
        const doc = await model
          .findOneAndDelete({
            _id: alert.student,
            requestedAt: alert.requestedAt,
          })
          .lean<ReturnAlertDoc>();
        return Boolean(doc);
      }),
    restore: alert =>
      guarded(async () => {
        try {
          await model.create(toReturnAlertDoc(alert));
        } catch (err) {
          // o aluno já pediu de novo: fica o novo
          if (!isDuplicateKey(err)) throw err;
        }
      }),
  };
}

/** O iPhone do aluno no banco: o aluno no `_id`. */
type PushDeviceDoc = {
  _id: string;
  platform: 'ios';
  token: string;
  updatedAt: Date;
  expiresAt: Date;
  wokenAt?: Date | null;
};

const toPushDevice = (doc: PushDeviceDoc): PortalPushDevice => ({
  student: doc._id,
  device: { platform: doc.platform, token: doc.token },
  updatedAt: doc.updatedAt,
  expiresAt: doc.expiresAt,
  wokenAt: doc.wokenAt ?? null,
});

/** Ainda não cutucado desde `since`. */
const wakeable = (since: Date) => ({
  $or: [{ wokenAt: null }, { wokenAt: { $lt: since } }],
});

/**
 * O iPhone de cada aluno para o cutucão da verificação no portal, um por
 * aluno e um dono por token. O índice TTL apaga os vencidos; até ele passar,
 * as consultas os ignoram.
 */
export function createPortalPushDeviceRepository(
  model: Models['portalPushDevices'],
): PortalPushDeviceRepository {
  return {
    find: (student, now) =>
      guarded(async () => {
        const doc = await model
          .findOne({ _id: student, expiresAt: { $gt: now } })
          .lean<PushDeviceDoc>();
        return doc ? toPushDevice(doc) : null;
      }),
    put: entry =>
      guarded(async () => {
        await model.deleteMany({
          token: entry.device.token,
          _id: { $ne: entry.student },
        });
        await model.updateOne(
          { _id: entry.student },
          {
            $set: {
              platform: entry.device.platform,
              token: entry.device.token,
              updatedAt: entry.updatedAt,
              expiresAt: entry.expiresAt,
            },
            $setOnInsert: { wokenAt: null },
          },
          { upsert: true },
        );
      }),
    remove: student =>
      guarded(async () => {
        await model.deleteOne({ _id: student });
      }),
    forget: (student, token) =>
      guarded(async () => {
        await model.deleteOne({ _id: student, token });
      }),
    listWakeable: (now, since) =>
      guarded(async () => {
        const docs = await model
          .find({ expiresAt: { $gt: now }, ...wakeable(since) })
          .lean<PushDeviceDoc[]>();
        return docs.map(toPushDevice);
      }),
    claimWake: (student, now, since) =>
      guarded(async () => {
        const { modifiedCount } = await model.updateOne(
          { _id: student, expiresAt: { $gt: now }, ...wakeable(since) },
          { $set: { wokenAt: now } },
        );
        return modifiedCount > 0;
      }),
  };
}
