import { UnavailableError } from '../src/shared/errors.ts';
import type {
  GitHubIssue,
  Idea,
  IdeaVote,
  TrackedIssue,
} from '../src/modules/ideas/domain.ts';
import type {
  IdeaRepository,
  IdeaVoteRepository,
  IssueTracker,
  TrackedIssueRepository,
} from '../src/modules/ideas/ports.ts';

/** As sugestões do app em memória, como no MongoDB. */
export function memoryIdeas() {
  const ideas: Idea[] = [];
  const votes: IdeaVote[] = [];
  const tracked = new Map<number, TrackedIssue>();
  let sequence = 0;
  const newest = (a: Idea, b: Idea) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);

  const ideaRepository: IdeaRepository = {
    async create(idea) {
      // como um ObjectId: 24 dígitos hex, em ordem
      const created = {
        ...idea,
        id: (++sequence).toString(16).padStart(24, '0'),
      };
      ideas.push(created);
      return { ...created };
    },
    async find(id) {
      const found = ideas.find(idea => idea.id === id);
      return found ? { ...found } : null;
    },
    async listByStudent(studentId, limit) {
      return ideas
        .filter(idea => idea.studentId === studentId)
        .sort(newest)
        .slice(0, limit)
        .map(idea => ({ ...idea }));
    },
    async countByStudentSince(studentId, since) {
      return ideas.filter(
        idea => idea.studentId === studentId && idea.createdAt >= since,
      ).length;
    },
    async listByStatus(statuses, limit) {
      return ideas
        .filter(idea => statuses.includes(idea.status))
        .sort(newest)
        .slice(0, limit)
        .map(idea => ({ ...idea }));
    },
    async decide(id, from, to) {
      const found = ideas.find(idea => idea.id === id && idea.status === from);
      if (!found) return null;
      Object.assign(found, {
        status: to.status,
        issue: to.issue,
        reviewedAt: to.at,
      });
      return { ...found };
    },
    async listIssueNumbers() {
      return [
        ...new Set(ideas.flatMap(idea => (idea.issue ? [idea.issue] : []))),
      ];
    },
  };

  const voteRepository: IdeaVoteRepository = {
    async add(vote) {
      if (
        votes.some(
          other =>
            other.issue === vote.issue && other.studentId === vote.studentId,
        )
      )
        return false;
      votes.push({ ...vote });
      return true;
    },
    async listByStudent(studentId) {
      return votes
        .filter(vote => vote.studentId === studentId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async count(issue) {
      return votes.filter(vote => vote.issue === issue).length;
    },
    async listIssueNumbers() {
      return [...new Set(votes.map(vote => vote.issue))];
    },
  };

  const trackedRepository: TrackedIssueRepository = {
    async put(issue) {
      tracked.set(issue.number, { ...issue });
    },
    async findMany(numbers) {
      return numbers.flatMap(number => {
        const found = tracked.get(number);
        return found ? [{ ...found }] : [];
      });
    },
  };

  return {
    ideas,
    votes,
    tracked,
    repositories: {
      ideas: ideaRepository,
      ideaVotes: voteRepository,
      trackedIssues: trackedRepository,
    },
  };
}

/**
 * Um repositório do GitHub em memória: os issues, os comentários e as
 * chamadas, para conferir o que o servidor mandou.
 */
export function fakeGitHub({ now = () => Date.now() } = {}) {
  const issues = new Map<number, GitHubIssue & { body: string }>();
  const comments: Array<{ issue: number; marker: string; body: string }> = [];
  const calls: string[] = [];
  let next = 100;
  let failing = false;

  const add = (
    issue: Partial<GitHubIssue> & { title: string; body?: string },
  ) => {
    const number = issue.number ?? ++next;
    next = Math.max(next, number);
    const created = {
      number,
      url: `https://github.com/pitroldev/ao-uerj-mobile-ts/issues/${number}`,
      state: 'open' as const,
      stateReason: null,
      labels: ['enhancement'],
      plusOnes: 0,
      pullRequest: false,
      updatedAt: new Date(now()),
      body: '',
      ...issue,
    };
    issues.set(number, created);
    return created;
  };

  const strip = ({ body: _body, ...issue }: GitHubIssue & { body: string }) =>
    ({ ...issue, labels: [...issue.labels] }) satisfies GitHubIssue;

  const guard = (what: string) => {
    calls.push(what);
    if (failing)
      throw new UnavailableError('github_unavailable', 'github is down');
  };

  const tracker: IssueTracker = {
    repository: 'pitroldev/ao-uerj-mobile-ts',
    async createIssue({ title, body, labels }) {
      guard('create');
      return strip(add({ title, body, labels }));
    },
    async getIssue(number) {
      guard(`get ${number}`);
      const found = issues.get(number);
      return found ? strip(found) : null;
    },
    async listOpen(label) {
      guard(`list ${label}`);
      return [...issues.values()]
        .filter(issue => issue.state === 'open' && issue.labels.includes(label))
        .map(strip);
    },
    async upsertComment(issue, marker, body) {
      guard(`comment ${issue}`);
      const found = comments.find(
        comment => comment.issue === issue && comment.marker === marker,
      );
      if (found) found.body = body;
      else comments.push({ issue, marker, body });
    },
  };

  return {
    tracker,
    issues,
    comments,
    calls,
    add,
    /** O GitHub fora do ar (ou recusando tudo). */
    fail(value = true) {
      failing = value;
    },
    close(number: number, stateReason: string) {
      const found = issues.get(number);
      if (found) Object.assign(found, { state: 'closed', stateReason });
    },
    label(number: number, ...labels: string[]) {
      const found = issues.get(number);
      if (found) found.labels.push(...labels);
    },
  };
}
