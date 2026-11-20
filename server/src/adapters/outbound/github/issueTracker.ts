import { sign, type KeyObject } from 'node:crypto';

import { z } from 'zod';

import type { GitHubIssue } from '../../../modules/ideas/domain.ts';
import type { IssueTracker } from '../../../modules/ideas/ports.ts';
import { systemClock, type Clock } from '../../../shared/clock.ts';
import { UnavailableError } from '../../../shared/errors.ts';

/*
 * Os issues do repositório pela conta do GitHub App do projeto ("AO UERJ
 * Sugestões"), instalado só neste repositório, com permissão de ler e
 * escrever issues e nada mais. O servidor assina um JWT com a chave do app,
 * troca pelo token da instalação (vale uma hora) e usa a API REST. Sem
 * biblioteca do GitHub.
 */

const API = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ao-uerj-server',
};
/** O token da instalação é trocado um pouco antes de vencer. */
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10 * 1000;

export type GitHubAppSettings = {
  appId: string;
  privateKey: KeyObject;
  /** "dono/repositório". */
  repository: string;
  /** Sem ele, o servidor pergunta ao GitHub (a instalação do app no repositório). */
  installationId: string | null;
};

const issueSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  state: z.enum(['open', 'closed']),
  state_reason: z.string().nullable().optional(),
  type: z.object({ name: z.string() }).nullable().optional(),
  labels: z
    .array(z.union([z.string(), z.object({ name: z.string().optional() })]))
    .default([]),
  reactions: z.object({ '+1': z.number().optional() }).optional(),
  pull_request: z.unknown().optional(),
  updated_at: z.string(),
});

function issueOf(raw: unknown): GitHubIssue {
  const issue = issueSchema.parse(raw);
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
    type: issue.type?.name ?? null,
    labels: issue.labels.flatMap(label =>
      typeof label === 'string' ? [label] : label.name ? [label.name] : [],
    ),
    plusOnes: issue.reactions?.['+1'] ?? 0,
    pullRequest: issue.pull_request !== undefined,
    updatedAt: new Date(issue.updated_at),
  };
}

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url');

/** O JWT do app (RS256, dez minutos), que pede o token da instalação. */
function appJwt(settings: GitHubAppSettings, nowMs: number) {
  const seconds = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // um minuto para trás, pelo relógio do GitHub
  const claims = base64url(
    JSON.stringify({
      iat: seconds - 60,
      exp: seconds + 540,
      iss: settings.appId,
    }),
  );
  const signature = sign(
    'sha256',
    Buffer.from(`${header}.${claims}`),
    settings.privateKey,
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

const failure = (detail: string, cause?: unknown) =>
  new UnavailableError(
    'github_unavailable',
    'GitHub did not answer as expected',
    {
      cause: cause ?? new Error(detail),
    },
  );

export function createGitHubIssueTracker(
  settings: GitHubAppSettings,
  {
    fetch = globalThis.fetch,
    now = systemClock,
  }: { fetch?: typeof globalThis.fetch; now?: Clock } = {},
): IssueTracker {
  const repo = settings.repository;
  let installation: string | null = settings.installationId;
  let token: { value: string; expiresAt: number } | null = null;

  async function call(
    method: string,
    path: string,
    auth: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        headers: {
          ...HEADERS,
          Authorization: auth,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw failure(`${method} ${path}`, err);
    }
    const json =
      response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, json };
  }

  async function installationId() {
    if (installation) return installation;
    const found = await call(
      'GET',
      `/repos/${repo}/installation`,
      `Bearer ${appJwt(settings, now())}`,
    );
    const id = (found.json as { id?: unknown } | null)?.id;
    if (found.status !== 200 || typeof id !== 'number')
      throw failure(`installation ${found.status}`);
    installation = String(id);
    return installation;
  }

  async function accessToken() {
    if (token && token.expiresAt - TOKEN_MARGIN_MS > now()) return token.value;
    const id = await installationId();
    const issued = await call(
      'POST',
      `/app/installations/${id}/access_tokens`,
      `Bearer ${appJwt(settings, now())}`,
    );
    const json = issued.json as {
      token?: unknown;
      expires_at?: unknown;
    } | null;
    if (
      issued.status !== 201 ||
      typeof json?.token !== 'string' ||
      typeof json.expires_at !== 'string'
    )
      throw failure(`access token ${issued.status}`);
    token = { value: json.token, expiresAt: Date.parse(json.expires_at) };
    return token.value;
  }

  async function api(method: string, path: string, body?: unknown) {
    const answer = await call(
      method,
      path,
      `Bearer ${await accessToken()}`,
      body,
    );
    // o token foi revogado (a instalação trocou): o próximo pede outro
    if (answer.status === 401) token = null;
    return answer;
  }

  const ok = (answer: { status: number }, expected: number[], what: string) => {
    if (!expected.includes(answer.status))
      throw failure(`${what} ${answer.status}`);
  };

  return {
    repository: repo,

    async createIssue(issue) {
      const answer = await api('POST', `/repos/${repo}/issues`, issue);
      ok(answer, [201], 'create issue');
      return issueOf(answer.json);
    },

    async getIssue(number) {
      const answer = await api('GET', `/repos/${repo}/issues/${number}`);
      // apagado, transferido ou de outro repositório: não existe para nós
      if ([404, 410].includes(answer.status)) return null;
      ok(answer, [200], 'get issue');
      return issueOf(answer.json);
    },

    async listOpen(type) {
      const query = new URLSearchParams({
        state: 'open',
        type,
        sort: 'updated',
        direction: 'desc',
        per_page: '100',
      });
      const answer = await api(
        'GET',
        `/repos/${repo}/issues?${query.toString()}`,
      );
      ok(answer, [200], 'list issues');
      if (!Array.isArray(answer.json)) throw failure('list issues: not a list');
      return answer.json.map(issueOf);
    },

    async upsertComment(issue, marker, body) {
      const listed = await api(
        'GET',
        `/repos/${repo}/issues/${issue}/comments?per_page=100`,
      );
      ok(listed, [200], 'list comments');
      const comments = Array.isArray(listed.json)
        ? (listed.json as Array<{
            id?: unknown;
            body?: unknown;
            performed_via_github_app?: { id?: unknown } | null;
          }>)
        : [];
      // só o comentário que o próprio app escreveu (a marca sozinha, qualquer um copia)
      const ours = comments.find(
        comment =>
          typeof comment.body === 'string' &&
          comment.body.includes(marker) &&
          String(comment.performed_via_github_app?.id) === settings.appId,
      );
      const answer = ours
        ? await api(
            'PATCH',
            `/repos/${repo}/issues/comments/${String(ours.id)}`,
            { body },
          )
        : await api('POST', `/repos/${repo}/issues/${issue}/comments`, {
            body,
          });
      ok(answer, [200, 201], 'comment');
    },
  };
}
