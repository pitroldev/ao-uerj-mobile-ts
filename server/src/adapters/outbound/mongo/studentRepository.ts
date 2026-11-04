import type {
  Ban,
  StoredSession,
  StoredStudent,
} from '../../../modules/students/domain.ts';
import type {
  StudentRepository,
  StudentSessionRepository,
} from '../../../modules/students/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

type StudentDoc = Omit<StoredStudent, 'id' | 'ban'> & {
  _id: string;
  ban?: Ban | null;
};

const toStudent = (doc: StudentDoc): StoredStudent => ({
  id: doc._id,
  lookup: doc.lookup,
  matricula: doc.matricula,
  name: doc.name,
  createdAt: doc.createdAt,
  lastSeenAt: doc.lastSeenAt,
  devices: (doc.devices ?? []).map(device => ({
    id: device.id,
    firstSeenAt: device.firstSeenAt,
    lastSeenAt: device.lastSeenAt,
  })),
  ban: doc.ban?.at
    ? { until: doc.ban.until ?? null, reason: doc.ban.reason, at: doc.ban.at }
    : null,
});

/** Os alunos: um documento por matrícula (o `lookup` é único). */
export function createStudentRepository(
  model: Models['students'],
): StudentRepository {
  const one = (doc: StudentDoc | null) => (doc ? toStudent(doc) : null);
  return {
    findByLookup: lookup =>
      guarded(async () =>
        one(await model.findOne({ lookup }).lean<StudentDoc>()),
      ),

    create: student =>
      guarded(async () => {
        const { id, ...rest } = student;
        try {
          await model.create({ _id: id, ...rest });
          return student;
        } catch (err) {
          // dois aparelhos entrando ao mesmo tempo com a mesma matrícula
          if (!isDuplicateKey(err)) throw err;
          const existing = await model
            .findOne({ lookup: student.lookup })
            .lean<StudentDoc>();
          if (!existing) throw err;
          return toStudent(existing);
        }
      }),

    seen: (id, { name, device, now, keepDevices }) =>
      guarded(async () => {
        // o aparelho conhecido ganha a hora; o novo entra, e a lista guarda
        // só os usados por último (ordenada pela hora antes de cortar)
        const known = await model.updateOne(
          { _id: id, 'devices.id': device },
          {
            $set: { name, lastSeenAt: now, 'devices.$.lastSeenAt': now },
          },
        );
        if (!known.matchedCount)
          await model.updateOne(
            { _id: id },
            {
              $set: { name, lastSeenAt: now },
              $push: {
                devices: {
                  $each: [{ id: device, firstSeenAt: now, lastSeenAt: now }],
                  $sort: { lastSeenAt: 1 },
                  $slice: -keepDevices,
                },
              },
            },
          );
        return one(await model.findById(id).lean<StudentDoc>());
      }),

    findById: id =>
      guarded(async () => one(await model.findById(id).lean<StudentDoc>())),

    findMany: ids =>
      guarded(async () =>
        (await model.find({ _id: { $in: [...ids] } }).lean<StudentDoc[]>()).map(
          toStudent,
        ),
      ),

    setBan: (id, ban) =>
      guarded(async () =>
        one(
          await model
            .findByIdAndUpdate(
              id,
              { $set: { ban } },
              { returnDocument: 'after' },
            )
            .lean<StudentDoc>(),
        ),
      ),

    listRecent: limit =>
      guarded(async () =>
        (
          await model
            .find()
            .sort({ lastSeenAt: -1 })
            .limit(limit)
            .lean<StudentDoc[]>()
        ).map(toStudent),
      ),

    listBanned: (now, limit) =>
      guarded(async () =>
        (
          await model
            .find({
              'ban.at': { $ne: null },
              $or: [{ 'ban.until': null }, { 'ban.until': { $gt: now } }],
            })
            .sort({ 'ban.at': -1 })
            .limit(limit)
            .lean<StudentDoc[]>()
        ).map(toStudent),
      ),
  };
}

type SessionDoc = Omit<StoredSession, 'id'> & { _id: string };

/** As sessões: o `_id` é o hash do token; o índice TTL apaga as vencidas. */
export function createStudentSessionRepository(
  model: Models['studentSessions'],
): StudentSessionRepository {
  return {
    create: session =>
      guarded(async () => {
        const { id, ...rest } = session;
        await model.create({ _id: id, ...rest });
      }),

    find: (id, now) =>
      guarded(async () => {
        const doc = await model
          .findOne({ _id: id, expiresAt: { $gt: now } })
          .lean<SessionDoc>();
        if (!doc) return null;
        const { _id, ...rest } = doc;
        return { id: _id, ...rest };
      }),

    touch: (id, now, expiresAt) =>
      guarded(async () => {
        await model.updateOne(
          { _id: id },
          { $set: { lastUsedAt: now, expiresAt } },
        );
      }),

    remove: id =>
      guarded(async () => {
        await model.deleteOne({ _id: id });
      }),
  };
}
