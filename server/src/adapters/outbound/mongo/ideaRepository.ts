import type {
  Idea,
  IdeaArea,
  IdeaPlatform,
  IdeaStatus,
  IssueStatus,
  PortalAnswer,
  TrackedIssue,
} from '../../../modules/ideas/domain.ts';
import type {
  IdeaRepository,
  IdeaVoteRepository,
  TrackedIssueRepository,
} from '../../../modules/ideas/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

/** Um id do Mongo; outro texto não chega a virar consulta (nem um CastError). */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

type StoredIdea = {
  _id: unknown;
  studentId: string;
  title: string;
  area: string;
  problem: string;
  idea?: string | null;
  portal: string;
  appVersion: string;
  platform: string;
  seenSimilar?: number[];
  status: string;
  issue?: number | null;
  createdAt: Date;
  reviewedAt?: Date | null;
};

const toIdea = (doc: StoredIdea): Idea => ({
  id: String(doc._id),
  studentId: doc.studentId,
  title: doc.title,
  area: doc.area as IdeaArea,
  problem: doc.problem,
  idea: doc.idea ?? null,
  portal: doc.portal as PortalAnswer,
  appVersion: doc.appVersion,
  platform: doc.platform as IdeaPlatform,
  seenSimilar: doc.seenSimilar ?? [],
  status: doc.status as IdeaStatus,
  issue: doc.issue ?? null,
  createdAt: doc.createdAt,
  reviewedAt: doc.reviewedAt ?? null,
});

export function createIdeaRepository(model: Models['ideas']): IdeaRepository {
  return {
    create: idea =>
      guarded(async () => {
        const created = await model.create(idea);
        return toIdea(created.toObject<StoredIdea>());
      }),
    find: id =>
      guarded(async () => {
        if (!OBJECT_ID.test(id)) return null;
        const found = await model.findById(id).lean<StoredIdea>();
        return found ? toIdea(found) : null;
      }),
    listByStudent: (studentId, limit) =>
      guarded(async () => {
        const found = await model
          .find({ studentId })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean<StoredIdea[]>();
        return found.map(toIdea);
      }),
    countByStudentSince: (studentId, since) =>
      guarded(() =>
        model.countDocuments({ studentId, createdAt: { $gte: since } }),
      ),
    listByStatus: (statuses, limit) =>
      guarded(async () => {
        const found = await model
          .find({ status: { $in: statuses } })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean<StoredIdea[]>();
        return found.map(toIdea);
      }),
    decide: (id, from, to) =>
      guarded(async () => {
        if (!OBJECT_ID.test(id)) return null;
        const updated = await model
          .findOneAndUpdate(
            { _id: id, status: from },
            {
              $set: {
                status: to.status,
                issue: to.issue,
                reviewedAt: to.at,
              },
            },
            { returnDocument: 'after' },
          )
          .lean<StoredIdea>();
        return updated ? toIdea(updated) : null;
      }),
    listIssueNumbers: () =>
      guarded(async () => {
        const numbers = await model.distinct('issue', {
          issue: { $ne: null },
        });
        return (numbers as unknown[]).filter(
          (value): value is number => typeof value === 'number',
        );
      }),
  };
}

type StoredVote = {
  _id: string;
  issue: number;
  studentId: string;
  createdAt: Date;
};

export function createIdeaVoteRepository(
  model: Models['ideaVotes'],
): IdeaVoteRepository {
  return {
    add: vote =>
      guarded(async () => {
        try {
          await model.create({
            _id: `${vote.issue}:${vote.studentId}`,
            ...vote,
          });
          return true;
        } catch (err) {
          // o mesmo aluno no mesmo issue: já contava
          if (isDuplicateKey(err)) return false;
          throw err;
        }
      }),
    listByStudent: studentId =>
      guarded(async () => {
        const found = await model
          .find({ studentId })
          .sort({ createdAt: -1 })
          .lean<StoredVote[]>();
        return found.map(({ issue, studentId: student, createdAt }) => ({
          issue,
          studentId: student,
          createdAt,
        }));
      }),
    count: issue => guarded(() => model.countDocuments({ issue })),
    listIssueNumbers: () =>
      guarded(async () => {
        const numbers = await model.distinct('issue');
        return (numbers as unknown[]).filter(
          (value): value is number => typeof value === 'number',
        );
      }),
  };
}

type StoredTracked = {
  _id: number;
  title: string;
  url: string;
  status: string;
  plusOnes?: number;
  fromApp?: boolean;
  updatedAt: Date;
};

export function createTrackedIssueRepository(
  model: Models['trackedIssues'],
): TrackedIssueRepository {
  return {
    put: issue =>
      guarded(async () => {
        await model.updateOne(
          { _id: issue.number },
          {
            $set: {
              title: issue.title,
              url: issue.url,
              status: issue.status,
              plusOnes: issue.plusOnes,
              fromApp: issue.fromApp,
              updatedAt: issue.updatedAt,
            },
          },
          { upsert: true },
        );
      }),
    findMany: numbers =>
      guarded(async () => {
        if (!numbers.length) return [];
        const found = await model
          .find({ _id: { $in: [...numbers] } })
          .lean<StoredTracked[]>();
        return found.map((doc): TrackedIssue => ({
          number: doc._id,
          title: doc.title,
          url: doc.url,
          status: doc.status as IssueStatus,
          plusOnes: doc.plusOnes ?? 0,
          fromApp: doc.fromApp ?? false,
          updatedAt: doc.updatedAt,
        }));
      }),
  };
}
