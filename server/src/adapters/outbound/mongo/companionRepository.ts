import {
  MAX_ALIVE_CALLS,
  type Call,
  type CallKind,
  type CallReport,
  type DestinationId,
  type Member,
  type PhraseId,
  type SpotId,
} from '../../../modules/companion/domain.ts';
import type {
  CallReportRepository,
  CallRepository,
} from '../../../modules/companion/ports.ts';
import { guarded } from './guarded.ts';
import type { Models } from './models.ts';

/** O documento: a chave do membro fica em `key` (o `id` é do Mongoose). */
type StoredCall = {
  _id: string;
  kind: CallKind;
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
  note?: string;
  capacity: number;
  members: { key: string; name: string; host: boolean; joinedAt: Date }[];
  feed: { key: string; name: string; phrase: PhraseId; at: Date }[];
  reporters: string[];
  endedAt: Date | null;
  hiddenAt: Date | null;
  visibleFrom: Date;
  listedUntil: Date;
  expiresAt: Date;
};

type StoredReport = Omit<CallReport, 'id'> & { _id: unknown };

function toCall(doc: StoredCall): Call {
  return {
    id: doc._id,
    kind: doc.kind,
    at: doc.at,
    spot: doc.spot,
    destination: doc.destination ?? null,
    note: doc.note ?? '',
    capacity: doc.capacity,
    members: doc.members.map(member => ({
      id: member.key,
      name: member.name,
      host: member.host,
      joinedAt: member.joinedAt,
    })),
    feed: doc.feed.map(entry => ({
      member: entry.key,
      name: entry.name,
      phrase: entry.phrase,
      at: entry.at,
    })),
    reporters: doc.reporters,
    endedAt: doc.endedAt ?? null,
    hiddenAt: doc.hiddenAt ?? null,
    visibleFrom: doc.visibleFrom,
    listedUntil: doc.listedUntil,
    expiresAt: doc.expiresAt,
  };
}

const storedMember = (member: Member) => ({
  key: member.id,
  name: member.name,
  host: member.host,
  joinedAt: member.joinedAt,
});

/** Ainda vale: o TTL do MongoDB passa só a cada minuto. */
const alive = (now: Date) => ({ expiresAt: { $gt: now }, hiddenAt: null });

/** Na lista agora. */
const listed = (now: Date) => ({
  visibleFrom: { $lte: now },
  listedUntil: { $gt: now },
  endedAt: null,
  hiddenAt: null,
});

const AFTER = { returnDocument: 'after' } as const;

export function createCallRepository(
  model: Models['companionCalls'],
): CallRepository {
  const one = (doc: StoredCall | null) => (doc ? toCall(doc) : null);
  return {
    create: call =>
      guarded(async () => {
        await model.create({
          _id: call.id,
          kind: call.kind,
          at: call.at,
          spot: call.spot,
          destination: call.destination,
          note: call.note,
          capacity: call.capacity,
          members: call.members.map(storedMember),
          feed: [],
          reporters: [],
          endedAt: null,
          hiddenAt: null,
          visibleFrom: call.visibleFrom,
          listedUntil: call.listedUntil,
          expiresAt: call.expiresAt,
        });
      }),
    listListed: now =>
      guarded(async () => {
        const docs = await model
          .find(listed(now))
          .sort({ at: 1 })
          .limit(MAX_ALIVE_CALLS)
          .lean<StoredCall[]>();
        return docs.map(toCall);
      }),
    countAlive: now => guarded(() => model.countDocuments(alive(now))),
    find: (callId, now) =>
      guarded(async () =>
        one(
          await model
            .findOne({ _id: callId, ...alive(now) })
            .lean<StoredCall>(),
        ),
      ),
    addMember: (callId, member, now) =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate(
              {
                _id: callId,
                ...listed(now),
                ...alive(now),
                // a vaga é conferida na mesma operação que a ocupa
                $expr: { $lt: [{ $size: '$members' }, '$capacity'] },
              },
              { $push: { members: storedMember(member) } },
              AFTER,
            )
            .lean<StoredCall>(),
        ),
      ),
    removeMember: (callId, member) =>
      guarded(async () => {
        await model.updateOne(
          { _id: callId },
          { $pull: { members: { key: member, host: false } } },
        );
      }),
    end: (callId, now) =>
      guarded(async () => {
        await model.updateOne(
          { _id: callId, endedAt: null },
          { $set: { endedAt: now } },
        );
      }),
    addFeed: (callId, entry, keep, now) =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate(
              {
                _id: callId,
                ...alive(now),
                endedAt: null,
                'members.key': entry.member,
              },
              {
                $push: {
                  feed: {
                    $each: [
                      {
                        key: entry.member,
                        name: entry.name,
                        phrase: entry.phrase,
                        at: entry.at,
                      },
                    ],
                    $slice: -keep,
                  },
                },
              },
              AFTER,
            )
            .lean<StoredCall>(),
        ),
      ),
    addReporter: (callId, reporter, now) =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate(
              { _id: callId, ...alive(now), reporters: { $ne: reporter } },
              { $push: { reporters: reporter } },
              AFTER,
            )
            .lean<StoredCall>(),
        ),
      ),
    hide: (callId, now) =>
      guarded(async () => {
        await model.updateOne(
          { _id: callId, hiddenAt: null },
          { $set: { hiddenAt: now } },
        );
      }),
  };
}

export function createCallReportRepository(
  model: Models['companionReports'],
): CallReportRepository {
  return {
    create: report =>
      guarded(async () => {
        await model.create(report);
      }),
    listRecent: limit =>
      guarded(async () => {
        const docs = await model
          .find()
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean<StoredReport[]>();
        return docs.map(({ _id, ...report }) => ({
          ...report,
          id: String(_id),
          destination: report.destination ?? null,
          note: report.note ?? '',
        }));
      }),
  };
}
