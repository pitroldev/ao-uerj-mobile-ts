import {
  answerId,
  MAX_ACTIVE_NOTICES,
  type Answer,
  type AnswerValue,
  type Block,
  type Contributor,
  type DayCounts,
  type Gate,
  type Notice,
  type Place,
} from '../../../modules/campus-now/domain.ts';
import type {
  AnswerRepository,
  ContributorRepository,
  DayRepository,
  NoticeRepository,
} from '../../../modules/campus-now/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

/** O aviso no banco: o lugar achatado. */
type NoticeDoc = Omit<Notice, 'id' | 'place'> & {
  _id: string;
  placeType: Place['type'];
  block: Block | null;
  floor: string | null;
  room: string | null;
  gate: Gate | null;
};

function toPlace(doc: NoticeDoc): Place {
  switch (doc.placeType) {
    case 'gate':
      return { type: 'gate', gate: doc.gate as Gate };
    case 'floor':
      return {
        type: 'floor',
        block: doc.block as Block,
        floor: doc.floor ?? '',
      };
    case 'room':
      return {
        type: 'room',
        block: doc.block as Block,
        floor: doc.floor ?? '',
        room: doc.room ?? '',
      };
    default:
      return { type: doc.placeType };
  }
}

function toNotice(doc: NoticeDoc): Notice {
  return {
    id: doc._id,
    kind: doc.kind,
    status: doc.status,
    place: toPlace(doc),
    placeKey: doc.placeKey,
    reporter: doc.reporter,
    level: doc.level ?? 1,
    trusted: doc.trusted ?? false,
    confirmations: doc.confirmations ?? 0,
    ends: doc.ends ?? 0,
    flags: doc.flags ?? 0,
    views: doc.views ?? 0,
    thanks: doc.thanks ?? 0,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    firstConfirmedAt: doc.firstConfirmedAt ?? null,
    endedAt: doc.endedAt ?? null,
    endedBy: doc.endedBy ?? null,
    removedAt: doc.removedAt ?? null,
    removedBy: doc.removedBy ?? null,
    penalized: doc.penalized ?? false,
    reviewedAt: doc.reviewedAt ?? null,
    purgeAt: doc.purgeAt,
  };
}

function storedNotice(notice: Notice) {
  const { id, place, ...rest } = notice;
  return {
    _id: id,
    ...rest,
    placeType: place.type,
    block: 'block' in place ? place.block : null,
    floor: 'floor' in place ? place.floor : null,
    room: 'room' in place ? place.room : null,
    gate: 'gate' in place ? place.gate : null,
  };
}

/** Vale agora: o TTL do MongoDB apaga só bem depois. */
const active = (now: Date) => ({
  endedAt: null,
  removedAt: null,
  expiresAt: { $gt: now },
});

const AFTER = { returnDocument: 'after' } as const;

/** A lista de uma consulta não passa disto (o teto de avisos valendo, com folga). */
const LIST_LIMIT = MAX_ACTIVE_NOTICES + 100;
/** O resumo de um mês: mais que isso, só o começo conta. */
const MONTH_LIMIT = 100_000;

export function createNoticeRepository(
  model: Models['campusNotices'],
): NoticeRepository {
  const many = async (query: Promise<NoticeDoc[]>) =>
    (await query).map(toNotice);
  const one = (doc: NoticeDoc | null) => (doc ? toNotice(doc) : null);
  const changedOne = async (query: Promise<{ modifiedCount: number }>) =>
    (await query).modifiedCount > 0;

  return {
    create: notice =>
      guarded(async () => {
        await model.create(storedNotice(notice));
      }),
    find: id =>
      guarded(async () => one(await model.findById(id).lean<NoticeDoc>())),
    findMany: ids =>
      guarded(() =>
        many(
          model
            .find({ _id: { $in: [...ids] } })
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    // sem ordem no banco: com ela, o MongoDB preferiria andar pelo índice da
    // data e passar pelos 70 dias guardados; os que valem são poucos, e o caso
    // de uso os ordena
    listActive: now =>
      guarded(() =>
        many(
          model.find(active(now)).limit(LIST_LIMIT).lean<NoticeDoc[]>().exec(),
        ),
      ),
    countActive: now => guarded(() => model.countDocuments(active(now))),
    listActiveAt: (kind, placeKey, now) =>
      guarded(() =>
        many(
          model
            .find({ ...active(now), kind, placeKey })
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    listByReporter: (student, since) =>
      guarded(() =>
        many(
          model
            .find({ reporter: student, createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    listCreated: (from, to) =>
      guarded(() =>
        many(
          model
            .find({ createdAt: { $gte: from, $lt: to } })
            .sort({ createdAt: 1 })
            .limit(MONTH_LIMIT)
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    addConfirmation: (id, expiresAt) =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate(
              { _id: id },
              { $inc: { confirmations: 1 }, $max: { expiresAt } },
              AFTER,
            )
            .lean<NoticeDoc>(),
        ),
      ),
    markFirstConfirmed: (id, now) =>
      guarded(() =>
        changedOne(
          model.updateOne(
            { _id: id, firstConfirmedAt: null },
            { $set: { firstConfirmedAt: now } },
          ),
        ),
      ),
    addEnd: id =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate({ _id: id }, { $inc: { ends: 1 } }, AFTER)
            .lean<NoticeDoc>(),
        ),
      ),
    addThanks: id =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate({ _id: id }, { $inc: { thanks: 1 } }, AFTER)
            .lean<NoticeDoc>(),
        ),
      ),
    addFlag: id =>
      guarded(async () =>
        one(
          await model
            .findOneAndUpdate({ _id: id }, { $inc: { flags: 1 } }, AFTER)
            .lean<NoticeDoc>(),
        ),
      ),
    addViews: ids =>
      guarded(async () => {
        if (!ids.length) return;
        await model.updateMany(
          { _id: { $in: [...ids] } },
          { $inc: { views: 1 } },
        );
      }),
    end: (id, now, by) =>
      guarded(() =>
        changedOne(
          model.updateOne(
            { _id: id, endedAt: null, removedAt: null },
            { $set: { endedAt: now, endedBy: by } },
          ),
        ),
      ),
    remove: (id, now, by) =>
      guarded(() =>
        changedOne(
          model.updateOne(
            { _id: id, removedAt: null },
            { $set: { removedAt: now, removedBy: by } },
          ),
        ),
      ),
    restore: id =>
      guarded(() =>
        changedOne(
          model.updateOne(
            { _id: id, removedAt: { $ne: null }, removedBy: { $ne: 'ban' } },
            { $set: { removedAt: null, removedBy: null } },
          ),
        ),
      ),
    setPenalized: (id, penalized) =>
      guarded(() =>
        changedOne(
          model.updateOne(
            { _id: id, penalized: !penalized },
            { $set: { penalized } },
          ),
        ),
      ),
    markReviewed: (id, now) =>
      guarded(async () => {
        await model.updateOne({ _id: id }, { $set: { reviewedAt: now } });
      }),
    listActiveBy: (student, now) =>
      guarded(() =>
        many(
          model
            .find({ ...active(now), reporter: student })
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    listFlagged: (since, limit) =>
      guarded(() =>
        many(
          model
            .find({ flags: { $gte: 1 }, createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
    countPendingFlags: since =>
      guarded(() =>
        model.countDocuments({
          flags: { $gte: 1 },
          createdAt: { $gte: since },
          reviewedAt: null,
        }),
      ),
    listRecent: limit =>
      guarded(() =>
        many(
          model
            .find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean<NoticeDoc[]>()
            .exec(),
        ),
      ),
  };
}

type AnswerDoc = {
  _id: string;
  notice: string;
  student: string;
  answer?: AnswerValue | null;
  thanked?: boolean;
  flagged?: boolean;
  seen?: boolean;
};

const toAnswer = (doc: AnswerDoc): Answer => ({
  notice: doc.notice,
  student: doc.student,
  answer: doc.answer ?? null,
  thanked: doc.thanked ?? false,
  flagged: doc.flagged ?? false,
  seen: doc.seen ?? false,
});

type Mark = 'thanked' | 'flagged' | 'seen';

/**
 * As respostas: cada gravação leva no filtro a condição (ainda não
 * respondeu, ainda não agradeceu) e cria a linha se ela não existe. Se a
 * linha existe e a condição falha, a criação bate no `_id` (E11000): o
 * aluno já tinha feito aquilo, e nada muda, nem com dois pedidos juntos.
 */
export function createAnswerRepository(
  model: Models['campusAnswers'],
): AnswerRepository {
  const fresh = (notice: string, student: string, purgeAt: Date) => ({
    notice,
    student,
    purgeAt,
  });

  /** Liga a marca uma vez só; `true` se ela estava desligada. */
  async function mark(
    notice: string,
    student: string,
    field: Mark,
    purgeAt: Date,
  ) {
    const others = (['thanked', 'flagged', 'seen'] as const).filter(
      item => item !== field,
    );
    try {
      const result = await model.updateOne(
        { _id: answerId(notice, student), [field]: { $ne: true } },
        {
          $set: { [field]: true },
          $setOnInsert: {
            ...fresh(notice, student, purgeAt),
            answer: null,
            ...Object.fromEntries(others.map(item => [item, false])),
          },
        },
        { upsert: true },
      );
      return result.modifiedCount + result.upsertedCount > 0;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  }

  return {
    answer: (notice, student, value, purgeAt) =>
      guarded(async () => {
        // "Continua" só sem resposta; "Acabou" sem resposta ou depois do "Continua"
        const filter =
          value === 'confirm'
            ? { _id: answerId(notice, student), answer: null }
            : { _id: answerId(notice, student), answer: { $ne: 'end' } };
        try {
          const before = await model
            .findOneAndUpdate(
              filter,
              {
                $set: { answer: value },
                $setOnInsert: {
                  ...fresh(notice, student, purgeAt),
                  thanked: false,
                  flagged: false,
                  seen: false,
                },
              },
              { upsert: true, returnDocument: 'before' },
            )
            .lean<AnswerDoc>();
          return { previous: before?.answer ?? null };
        } catch (err) {
          if (isDuplicateKey(err)) return null;
          throw err;
        }
      }),
    mark: (notice, student, field, purgeAt) =>
      guarded(() => mark(notice, student, field, purgeAt)),
    see: (notices, student) =>
      guarded(async () => {
        const results = await Promise.all(
          notices.map(async ({ id, purgeAt }) =>
            (await mark(id, student, 'seen', purgeAt)) ? id : null,
          ),
        );
        return results.filter((id): id is string => id !== null);
      }),
    forStudent: (student, notices) =>
      guarded(async () => {
        if (!notices.length) return [];
        const docs = await model
          .find({ _id: { $in: notices.map(id => answerId(id, student)) } })
          .lean<AnswerDoc[]>();
        return docs.map(toAnswer);
      }),
  };
}

type PersonDoc = Omit<Contributor, 'student'> & { _id: string };

const toContributor = (doc: PersonDoc): Contributor => ({
  student: doc._id,
  points: doc.points ?? 0,
  notices: doc.notices ?? 0,
  answers: doc.answers ?? 0,
  confirmedNotices: doc.confirmedNotices ?? 0,
  thanksReceived: doc.thanksReceived ?? 0,
  viewsReceived: doc.viewsReceived ?? 0,
});

/** Os pontos e as contagens de sempre: um documento por aluno. */
export function createContributorRepository(
  model: Models['campusPeople'],
): ContributorRepository {
  return {
    find: student =>
      guarded(async () => {
        const doc = await model.findById(student).lean<PersonDoc>();
        return doc ? toContributor(doc) : null;
      }),
    add: (student, change) =>
      guarded(async () => {
        const inc = Object.fromEntries(
          Object.entries(change).filter(
            ([, value]) => typeof value === 'number' && value !== 0,
          ),
        );
        const update = async () =>
          model
            .findOneAndUpdate(
              { _id: student },
              Object.keys(inc).length ? { $inc: inc } : {},
              { upsert: true, ...AFTER },
            )
            .lean<PersonDoc>();
        let doc: PersonDoc | null;
        try {
          doc = await update();
        } catch (err) {
          // dois pedidos criando o mesmo aluno: o segundo soma no do primeiro
          if (!isDuplicateKey(err)) throw err;
          doc = await update();
        }
        // os pontos nunca ficam negativos (o aviso tirado do ar de quem tinha pouco)
        if (doc && doc.points < 0) {
          await model.updateOne(
            { _id: student, points: { $lt: 0 } },
            { $set: { points: 0 } },
          );
          doc = { ...doc, points: 0 };
        }
        return toContributor(doc ?? { _id: student, ...emptyCounts() });
      }),
  };
}

const emptyCounts = () => ({
  points: 0,
  notices: 0,
  answers: 0,
  confirmedNotices: 0,
  thanksReceived: 0,
  viewsReceived: 0,
});

type DayDoc = DayCounts & { _id: string; day: string };

/** As contagens do dia de cada aluno: um documento por aluno e dia. */
export function createDayRepository(
  model: Models['campusDays'],
): DayRepository {
  return {
    add: (student, day, field, amount, purgeAt) =>
      guarded(async () => {
        const update = () =>
          model
            .findOneAndUpdate(
              { _id: `${student}:${day}` },
              { $inc: { [field]: amount }, $setOnInsert: { day, purgeAt } },
              { upsert: true, ...AFTER },
            )
            .lean<DayDoc>();
        let doc: DayDoc | null;
        try {
          doc = await update();
        } catch (err) {
          if (!isDuplicateKey(err)) throw err;
          doc = await update();
        }
        return {
          notices: doc?.notices ?? 0,
          answers: doc?.answers ?? 0,
          thanks: doc?.thanks ?? 0,
        };
      }),
    countDay: day => guarded(() => model.countDocuments({ day })),
  };
}
