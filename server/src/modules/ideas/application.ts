import { cacheFor, systemClock, type Clock } from '../../shared/clock.ts';
import {
  LimitError,
  NotFoundError,
  UnavailableError,
} from '../../shared/errors.ts';
import type { StudentActor } from '../students/ports.ts';
import {
  checkIdea,
  IDEA_LIMITS,
  issueBody,
  issueTitle,
  LABELS,
  similarIssues,
  SUGGESTION_TYPE,
  trackedOf,
  VOTES_MARKER,
  votesComment,
  type Idea,
  type TrackedIssue,
} from './domain.ts';
import type {
  IdeaRepository,
  Ideas,
  IdeaVoteRepository,
  IssueTracker,
  MyIdea,
  SimilarIssue,
  TrackedIssueRepository,
} from './ports.ts';

/** Os issues de sugestão abertos, para as parecidas: dez minutos de cache. */
export const OPEN_ISSUES_CACHE_MS = 10 * 60 * 1000;
/** As decididas que a moderação vê no "Feitos". */
export const DECIDED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MINE_LIMIT = 50;
const REVIEW_PAGE = 100;
/** Os issues que a rodada lê de uma vez, no máximo. */
const SYNC_LIMIT = 300;

const SAO_PAULO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** A meia-noite do dia de `date` em São Paulo (sem horário de verão desde 2019). */
const startOfDay = (date: Date) =>
  new Date(`${SAO_PAULO_DAY.format(date)}T00:00:00-03:00`);

const unavailable = () =>
  new UnavailableError(
    'suggestions_unavailable',
    'Suggestions cannot reach GitHub right now',
  );

export function createIdeas({
  ideas,
  votes,
  tracked,
  tracker,
  now = systemClock,
  onError = () => undefined,
}: {
  ideas: IdeaRepository;
  votes: IdeaVoteRepository;
  tracked: TrackedIssueRepository;
  /** `null` sem o GitHub configurado: o app manda, mas nada é publicado. */
  tracker: IssueTracker | null;
  now?: Clock;
  /** O que falhou sem derrubar o pedido (o comentário com a contagem). */
  onError?: (err: unknown) => void;
}): Ideas {
  const at = () => new Date(now());

  // os issues de sugestão abertos (o tipo do formulário), que também
  // atualizam o estado acompanhado de cada um
  const openIssues = cacheFor(
    async () => {
      if (!tracker) return [] as TrackedIssue[];
      const found = await tracker.listOpen(SUGGESTION_TYPE);
      const list = found
        .filter(issue => !issue.pullRequest)
        .map(issue => trackedOf(issue));
      await Promise.all(list.map(issue => tracked.put(issue)));
      return list;
    },
    { ttlMs: OPEN_ISSUES_CACHE_MS, now },
  );

  const requestsOf = async (issue: TrackedIssue) =>
    (await votes.count(issue.number)) + issue.plusOnes;

  const similarView = async (issue: TrackedIssue): Promise<SimilarIssue> => ({
    number: issue.number,
    title: issue.title,
    url: issue.url,
    status: issue.status,
    requests: await requestsOf(issue),
  });

  async function similar(text: string) {
    if (!tracker) return [];
    const found = similarIssues(text, await openIssues.get());
    return Promise.all(found.map(similarView));
  }

  /** O comentário com a contagem do app; num issue do app, a partir do segundo pedido. */
  async function refreshVotes(issue: TrackedIssue) {
    if (!tracker) return;
    const count = await votes.count(issue.number);
    if (count < (issue.fromApp ? 2 : 1)) return;
    await tracker
      .upsertComment(issue.number, VOTES_MARKER, votesComment(count))
      .catch(onError);
  }

  /** O issue de sugestão aberto, lido agora no GitHub. */
  async function openSuggestion(number: number) {
    if (!tracker) throw unavailable();
    const found =
      Number.isInteger(number) && number > 0
        ? await tracker.getIssue(number)
        : null;
    if (
      !found ||
      found.pullRequest ||
      found.state !== 'open' ||
      found.type !== SUGGESTION_TYPE
    )
      return null;
    const issue = trackedOf(found);
    await tracked.put(issue);
    return issue;
  }

  function sentView(
    idea: Idea,
    issue: TrackedIssue | undefined,
    requests: number,
  ): MyIdea {
    return {
      id: idea.id,
      kind: 'sent',
      title: idea.title,
      area: idea.area,
      createdAt: idea.createdAt,
      status:
        idea.status === 'received'
          ? 'received'
          : idea.status === 'archived'
            ? 'not_published'
            : (issue?.status ?? 'open'),
      issue:
        idea.issue && issue ? { number: issue.number, url: issue.url } : null,
      requests,
    };
  }

  const joinedView = (
    vote: { issue: number; createdAt: Date },
    issue: TrackedIssue,
    requests: number,
  ): MyIdea => ({
    id: `issue-${vote.issue}`,
    kind: 'joined',
    title: issue.title.replace(/^\[sugest[ãa]o\]\s*/i, ''),
    area: null,
    createdAt: vote.createdAt,
    status: issue.status,
    issue: { number: issue.number, url: issue.url },
    requests,
  });

  return {
    publishing: () => tracker !== null,
    repository: () => tracker?.repository ?? null,

    async mine({ studentId }: StudentActor) {
      const [sent, voted, today] = await Promise.all([
        ideas.listByStudent(studentId, MINE_LIMIT),
        votes.listByStudent(studentId),
        ideas.countByStudentSince(studentId, startOfDay(at())),
      ]);
      const own = new Set(
        sent.flatMap(idea => (idea.issue ? [idea.issue] : [])),
      );
      const joined = voted.filter(vote => !own.has(vote.issue));
      const numbers = [...new Set([...own, ...joined.map(vote => vote.issue)])];
      const issues = new Map(
        (await tracked.findMany(numbers)).map(issue => [issue.number, issue]),
      );
      const counts = new Map(
        await Promise.all(
          [...issues.values()].map(
            async issue => [issue.number, await requestsOf(issue)] as const,
          ),
        ),
      );
      const list: MyIdea[] = [
        ...sent.map(idea => {
          const issue = idea.issue ? issues.get(idea.issue) : undefined;
          return sentView(
            idea,
            issue,
            issue ? (counts.get(issue.number) ?? 1) : 1,
          );
        }),
        ...joined.flatMap(vote => {
          const issue = issues.get(vote.issue);
          return issue
            ? [joinedView(vote, issue, counts.get(issue.number) ?? 1)]
            : [];
        }),
      ];
      return {
        ideas: list.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        ),
        remainingToday: Math.max(0, IDEA_LIMITS.perDay - today),
      };
    },

    similar,

    async submit(request, { studentId }) {
      const checked = checkIdea(request);
      const time = at();
      const today = await ideas.countByStudentSince(
        studentId,
        startOfDay(time),
      );
      if (today >= IDEA_LIMITS.perDay)
        throw new LimitError(
          'idea_limit',
          `At most ${IDEA_LIMITS.perDay} suggestions a day`,
        );
      const created = await ideas.create({
        ...checked,
        studentId,
        status: 'received',
        issue: null,
        createdAt: time,
        reviewedAt: null,
      });
      return sentView(created, undefined, 1);
    },

    async vote(number, { studentId }) {
      const issue = await openSuggestion(number);
      if (!issue)
        throw new NotFoundError(
          'issue_not_found',
          'This suggestion is closed or does not exist',
        );
      const time = at();
      if (await votes.add({ issue: issue.number, studentId, createdAt: time }))
        await refreshVotes(issue);
      return joinedView(
        { issue: issue.number, createdAt: time },
        issue,
        await requestsOf(issue),
      );
    },

    async forReview() {
      const [received, decided] = await Promise.all([
        ideas.listByStatus(['received'], REVIEW_PAGE),
        ideas.listByStatus(['published', 'merged', 'archived'], REVIEW_PAGE),
      ]);
      const since = now() - DECIDED_WINDOW_MS;
      return {
        received,
        decided: decided
          .filter(
            idea => (idea.reviewedAt ?? idea.createdAt).getTime() >= since,
          )
          .sort(
            (a, b) =>
              (b.reviewedAt ?? b.createdAt).getTime() -
              (a.reviewedAt ?? a.createdAt).getTime(),
          ),
      };
    },

    find: id => ideas.find(id),

    similarFor: idea => similar(`${idea.title} ${idea.problem}`),

    async publish(id) {
      if (!tracker) return { result: 'unavailable' };
      // a marca vem antes do GitHub: duas abas não abrem dois issues
      const claimed = await ideas.decide(id, 'received', {
        status: 'published',
        issue: null,
        at: at(),
      });
      if (!claimed) return { result: 'gone' };
      let created;
      try {
        created = await tracker.createIssue({
          title: issueTitle(claimed),
          body: issueBody(claimed),
          type: SUGGESTION_TYPE,
          labels: [LABELS.fromApp, LABELS.area(claimed.area)],
        });
      } catch (err) {
        await ideas.decide(id, 'published', {
          status: 'received',
          issue: null,
          at: null,
        });
        throw err;
      }
      const issue = trackedOf(created);
      await ideas.decide(id, 'published', {
        status: 'published',
        issue: issue.number,
        at: claimed.reviewedAt,
      });
      await tracked.put(issue);
      await votes.add({
        issue: issue.number,
        studentId: claimed.studentId,
        createdAt: claimed.createdAt,
      });
      return { result: 'published', issue };
    },

    async merge(id, number) {
      if (!tracker) return 'unavailable';
      const idea = await ideas.find(id);
      if (!idea || idea.status !== 'received') return 'gone';
      const issue = await openSuggestion(number);
      if (!issue) return 'issue_not_found';
      const merged = await ideas.decide(id, 'received', {
        status: 'merged',
        issue: issue.number,
        at: at(),
      });
      if (!merged) return 'gone';
      if (
        await votes.add({
          issue: issue.number,
          studentId: idea.studentId,
          createdAt: idea.createdAt,
        })
      )
        await refreshVotes(issue);
      return 'merged';
    },

    async archive(id) {
      const done = await ideas.decide(id, 'received', {
        status: 'archived',
        issue: null,
        at: at(),
      });
      return done ? 'archived' : 'gone';
    },

    async reopen(id) {
      const done = await ideas.decide(id, 'archived', {
        status: 'received',
        issue: null,
        at: null,
      });
      return done ? 'reopened' : 'gone';
    },

    async syncIssues() {
      if (!tracker) return 0;
      const numbers = [
        ...new Set([
          ...(await ideas.listIssueNumbers()),
          ...(await votes.listIssueNumbers()),
        ]),
      ].slice(0, SYNC_LIMIT);
      let read = 0;
      for (const number of numbers) {
        const found = await tracker.getIssue(number);
        if (!found) continue;
        await tracked.put(trackedOf(found));
        read += 1;
      }
      return read;
    },
  };
}
