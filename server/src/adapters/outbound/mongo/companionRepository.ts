import {
  MAX_ALIVE_CALLS,
  removedStudent,
  STAT_KEYS,
  type Call,
  type CallKind,
  type CallReport,
  type CallWatch,
  type DayStats,
  type DestinationId,
  type Member,
  type PhraseId,
  type SpotId,
} from '../../../modules/companion/domain.ts';
import type {
  CallReportRepository,
  CallRepository,
  CallWatchRepository,
  CompanionStatsRepository,
  WatcherRepository,
} from '../../../modules/companion/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
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
  members: {
    key: string;
    ref?: string;
    name: string;
    host: boolean;
    joinedAt: Date;
    student?: string | null;
  }[];
  feed: { key: string; name: string; phrase: PhraseId; at: Date }[];
  reporters: string[];
  removed?: string[];
  endedAt: Date | null;
  hiddenAt: Date | null;
  filledAt?: Date | null;
  arrivedAt?: Date | null;
  visibleFrom: Date;
  listedUntil: Date;
  expiresAt: Date;
};

type StoredReport = Omit<
  CallReport,
  | 'id'
  | 'source'
  | 'callExpiresAt'
  | 'people'
  | 'reporterStudent'
  | 'hiddenBy'
  | 'reviewedAt'
> & {
  _id: unknown;
  source?: CallReport['source'];
  callExpiresAt?: Date | null;
  people?: CallReport['people'];
  reporterStudent?: string | null;
  hiddenBy?: CallReport['hiddenBy'];
  reviewedAt?: Date | null;
};

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
      ref: member.ref ?? '',
      name: member.name,
      host: member.host,
      joinedAt: member.joinedAt,
      student: member.student ?? null,
    })),
    feed: doc.feed.map(entry => ({
      member: entry.key,
      name: entry.name,
      phrase: entry.phrase,
      at: entry.at,
    })),
    reporters: doc.reporters,
    removed: doc.removed ?? [],
    endedAt: doc.endedAt ?? null,
    hiddenAt: doc.hiddenAt ?? null,
    filledAt: doc.filledAt ?? null,
    arrivedAt: doc.arrivedAt ?? null,
    visibleFrom: doc.visibleFrom,
    listedUntil: doc.listedUntil,
    expiresAt: doc.expiresAt,
  };
}

const storedMember = (member: Member) => ({
  key: member.id,
  ref: member.ref,
  name: member.name,
  host: member.host,
  joinedAt: member.joinedAt,
  student: member.student,
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
          removed: [],
          endedAt: null,
          hiddenAt: null,
          filledAt: null,
          arrivedAt: null,
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
    listAliveWith: (student, now) =>
      guarded(async () => {
        const docs = await model
          .find({ ...alive(now), 'members.student': student })
          .lean<StoredCall[]>();
        return docs.map(toCall);
      }),
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
                // e o aluno, também: nem duas vezes, nem depois de tirado
                ...(member.student
                  ? {
                      'members.student': { $ne: member.student },
                      removed: { $ne: removedStudent(member.student) },
                    }
                  : {}),
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
    expel: (callId, member) =>
      guarded(async () => {
        await model.updateOne(
          { _id: callId },
          {
            $pull: { members: { key: member, host: false } },
            $addToSet: { removed: member },
          },
        );
      }),
    mark: (callId, field, now) =>
      guarded(async () => {
        const result = await model.updateOne(
          { _id: callId, [field]: null },
          { $set: { [field]: now } },
        );
        return result.modifiedCount === 1;
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
          source: report.source ?? null,
          people: (report.people ?? []).map(person => ({
            name: person.name,
            host: person.host,
            student: person.student ?? null,
          })),
          reporterStudent: report.reporterStudent ?? null,
          hiddenBy: report.hiddenBy ?? null,
          reviewedAt: report.reviewedAt ?? null,
          callExpiresAt: report.callExpiresAt ?? null,
        }));
      }),
    markHidden: (callId, by) =>
      guarded(async () => {
        await model.updateMany(
          { callId },
          { $set: { hidden: true, hiddenBy: by } },
        );
      }),
    markReviewed: (callId, at) =>
      guarded(async () => {
        await model.updateMany({ callId }, { $set: { reviewedAt: at } });
      }),
  };
}

const COUNTED = new Set<string>(STAT_KEYS);
/** Só as contagens que o domínio conhece, para nada estranho virar campo. */
const countable = (key: string) =>
  COUNTED.has(key) || /^(?:lookers|empty)_h(?:[0-9]|1[0-9]|2[0-3])$/.test(key);

export function createCompanionStatsRepository(
  model: Models['companionStats'],
): CompanionStatsRepository {
  return {
    add: (day, counts, until) =>
      guarded(async () => {
        const inc = Object.fromEntries(
          Object.entries(counts)
            .filter(([key, value]) => countable(key) && Number.isFinite(value))
            .map(([key, value]) => [`counts.${key}`, value]),
        );
        if (!Object.keys(inc).length) return;
        await model.updateOne(
          { _id: day },
          { $inc: inc, $setOnInsert: { expiresAt: until } },
          { upsert: true },
        );
      }),
    listRecent: days =>
      guarded(async () => {
        const docs = await model
          .find()
          .sort({ _id: -1 })
          .limit(days)
          .lean<{ _id: string; counts?: DayStats['counts'] }[]>();
        return docs.map(doc => ({ day: doc._id, counts: doc.counts ?? {} }));
      }),
  };
}

export function createWatcherRepository(
  model: Models['companionWatchers'],
): WatcherRepository {
  return {
    see: (viewer, now, until) =>
      guarded(async () => {
        const before = await model
          .findOneAndUpdate(
            { _id: viewer },
            { $set: { expiresAt: until } },
            { upsert: true, returnDocument: 'before' },
          )
          .lean<{ expiresAt: Date }>();
        return !before || before.expiresAt <= now;
      }),
    count: now =>
      guarded(() => model.countDocuments({ expiresAt: { $gt: now } })),
  };
}

/** O pedido de aviso no banco: o aluno no `_id`, o aparelho aberto em campos. */
type StoredWatch = {
  _id: string;
  kind: CallKind;
  until: Date;
  seen?: string[];
  platform: 'ios';
  token: string;
  createdAt: Date;
};

const toStoredWatch = (watch: CallWatch): StoredWatch => ({
  _id: watch.student,
  kind: watch.kind,
  until: watch.until,
  seen: watch.seen,
  platform: watch.device.platform,
  token: watch.device.token,
  createdAt: watch.createdAt,
});

const toCallWatch = (doc: StoredWatch): CallWatch => ({
  student: doc._id,
  kind: doc.kind,
  until: doc.until,
  seen: doc.seen ?? [],
  device: { platform: doc.platform, token: doc.token },
  createdAt: doc.createdAt,
});

/**
 * Os pedidos de "Me avise se abrirem", um por aluno (o `_id`). O índice TTL
 * em `until` apaga os vencidos; até ele passar, as consultas os ignoram.
 */
export function createCallWatchRepository(
  model: Models['companionCallWatches'],
): CallWatchRepository {
  return {
    put: watch =>
      guarded(async () => {
        const { _id, ...fields } = toStoredWatch(watch);
        await model.replaceOne({ _id }, fields, { upsert: true });
      }),
    find: (student, now) =>
      guarded(async () => {
        const doc = await model
          .findOne({ _id: student, until: { $gt: now } })
          .lean<StoredWatch>();
        return doc ? toCallWatch(doc) : null;
      }),
    listActive: now =>
      guarded(async () => {
        const docs = await model
          .find({ until: { $gt: now } })
          .lean<StoredWatch[]>();
        return docs.map(toCallWatch);
      }),
    claim: watch =>
      guarded(async () => {
        const doc = await model
          .findOneAndDelete({ _id: watch.student, createdAt: watch.createdAt })
          .lean<StoredWatch>();
        return Boolean(doc);
      }),
    restore: watch =>
      guarded(async () => {
        try {
          await model.create(toStoredWatch(watch));
        } catch (err) {
          // o aluno já fez outro pedido: fica o novo
          if (!isDuplicateKey(err)) throw err;
        }
      }),
    remove: student =>
      guarded(async () => {
        await model.deleteOne({ _id: student });
      }),
  };
}
