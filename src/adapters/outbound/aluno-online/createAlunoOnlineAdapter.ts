import type {
  AcademicRecordsPort,
  AcademicRequestOptions,
} from '@root/modules/academics/application/ports';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import type {
  Credentials,
  StudentProfile,
} from '@root/modules/identity/domain/types';
import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalCookieJar,
  PortalTransport,
  PortalOperation,
  PortalOperationParams,
  PortalResponse,
} from './contracts';
import { loadHtml, type CheerioAPI } from './html';
import { isSessionExpiredResponse } from './isSessionExpiredResponse';
import { parseLoginReqId } from './parsers/parseLoginReqId';
import {
  parseLoginInfo,
  rejectsCredentials,
  reportsUnavailableAccount,
} from './parsers/parseLoginData';
import { getReqIds } from './parsers/parseReqIds';
import { parseSubjectInfoReqId } from './parsers/subjectInfoReqId';
import { parseClassGrades } from './parsers/ClassGrades';
import { parseSubjectsTaken } from './parsers/SubjectsTaken';
import { parseCurriculumSubjects } from './parsers/CurriculumSubjects';
import { parseAttendedClassesSchedule } from './parsers/AttendedClassesSchedule';
import { parsePartialRID } from './parsers/PartialRID';
import { parseSubjectInfo } from './parsers/SubjectInfo';
import { parseUniversalSubjects } from './parsers/UniversalSubjects';

type Dependencies = {
  transport: PortalTransport;
  cookies: PortalCookieJar;
  readCredentials: () => Promise<Credentials | null>;
};

/** A response loaded once; session detection and the parser share `$`. */
type PortalPage = { html: string; $: CheerioAPI };

type Session = {
  generation: number;
  token: string;
  dictionary: Record<string, string>;
  profile: StudentProfile;
};

const operationKeys: Record<PortalOperation, string[]> = {
  grades: ['notas'],
  history: ['DisciplinasRealizadas'],
  curriculum: ['DisciplinasCursar'],
  schedule: ['Disciplinas em Curso', 'DisciplinasCurso'],
  partialRid: ['RidParcial'],
  subjectDetails: ['DadosDisciplina'],
  universalSubjects: ['UniversaisCursar'],
};

function checkStatus(response: PortalResponse) {
  if (response.status === 429) throw new AppError('RATE_LIMITED');
  if (response.status >= 500) throw new AppError('SERVICE_UNAVAILABLE');
  if (response.status >= 400) throw new AppError('PORTAL_LAYOUT_CHANGED');
}

function parse<T>(parser: ($: CheerioAPI) => T, $: CheerioAPI): T {
  try {
    return parser($);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('PORTAL_LAYOUT_CHANGED');
  }
}

export function createAlunoOnlineAdapter({
  transport,
  cookies,
  readCredentials,
}: Dependencies) {
  let identityGeneration = 0;
  let sessionGeneration = 0;
  let session: Session | null = null;
  let inFlightRefresh: Promise<StudentProfile> | null = null;
  let cleanup: Promise<void> = Promise.resolve();
  let cookieMutation: Promise<void> = Promise.resolve();
  const activeRequests = new Set<Promise<PortalResponse>>();

  function clearCookies() {
    cookieMutation = cookieMutation
      .catch(() => undefined)
      .then(() => cookies.clear());
    return cookieMutation;
  }

  function guard(identity: number, signal?: AbortSignal) {
    if (identity !== identityGeneration || signal?.aborted) {
      throw new AppError('CANCELLED');
    }
  }

  async function request(
    identity: number,
    path: string,
    params?: Record<string, string | undefined>,
    signal?: AbortSignal,
  ) {
    guard(identity, signal);
    try {
      const pending = transport.request({ path, params, signal });
      activeRequests.add(pending);
      let response: PortalResponse;
      try {
        response = await pending;
      } finally {
        activeRequests.delete(pending);
      }
      guard(identity, signal);
      return response;
    } catch (error) {
      guard(identity, signal);
      if (error instanceof AppError) throw error;
      throw new AppError('NETWORK');
    }
  }

  // Invalidates JavaScript work immediately, then drains native cookie writes
  // before clearing the jar. A subsequent sign-in waits for this same barrier.
  function invalidateIdentity() {
    identityGeneration += 1;
    session = null;
    inFlightRefresh = null;
    cleanup = cleanup
      .catch(() => undefined)
      .then(async () => {
        await transport.cancelAndDrain();
        await clearCookies();
      });
    return cleanup;
  }

  async function authenticate(
    credentials: Credentials,
    identity: number,
  ): Promise<StudentProfile> {
    guard(identity);
    if (!credentials.matricula.trim() || !credentials.password) {
      throw new AppError('INVALID_INPUT');
    }
    const root = await request(identity, '/');
    checkStatus(root);
    const loginPage = await request(identity, '/requisicaoaluno/');
    checkStatus(loginPage);
    let login: { loginReqId: string; _token: string };
    try {
      login = await parseLoginReqId(loadHtml(loginPage.body));
    } catch {
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    }
    guard(identity);
    const home = await request(identity, '/requisicaoaluno/', {
      requisicao: login.loginReqId,
      matricula: credentials.matricula,
      senha: credentials.password,
      _token: login._token,
    });
    checkStatus(home);
    const homePage = loadHtml(home.body);
    const info = parse(parseLoginInfo, homePage);
    if (!info.nome && reportsUnavailableAccount(info.fail_reason)) {
      throw new AppError('ACCOUNT_UNAVAILABLE');
    }
    if (!info.nome && rejectsCredentials(info.fail_reason)) {
      throw new AppError('LOGIN_FAILED');
    }
    if (isSessionExpiredResponse(home.body, homePage))
      throw new AppError('SESSION_EXPIRED');
    if (!info.nome) throw new AppError('PORTAL_LAYOUT_CHANGED');
    const { dictionary, failed } = parse(getReqIds, homePage);
    if (failed > 20) throw new AppError('POSSIBLY_BLOCKED');
    if (!Object.keys(dictionary).length)
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    guard(identity);
    const profile: StudentProfile = {
      matricula: credentials.matricula,
      name: info.nome,
      // Some portal versions label this header simply "Aluno Online".
      // Calendar guesses are not an authoritative academic semester.
      period: info.periodo || 'current',
    };
    sessionGeneration += 1;
    session = {
      generation: sessionGeneration,
      token: login._token,
      dictionary,
      profile,
    };
    return profile;
  }

  async function authenticateWithRecovery(
    credentials: Credentials,
    identity: number,
  ): Promise<StudentProfile> {
    try {
      return await authenticate(credentials, identity);
    } catch (error) {
      guard(identity);
      // The portal can invalidate its anonymous bootstrap before authentication
      // completes. Recover that specific response once; rejected credentials,
      // network failures and unknown layouts must never repeat a login.
      if (!(error instanceof AppError) || error.code !== 'SESSION_EXPIRED') {
        throw error;
      }
      await Promise.allSettled(activeRequests);
      guard(identity);
      await clearCookies();
      guard(identity);
      return authenticate(credentials, identity);
    }
  }

  function refresh(): Promise<StudentProfile> {
    if (inFlightRefresh) return inFlightRefresh;
    const identity = identityGeneration;
    const task = (async () => {
      await cleanup;
      guard(identity);
      const credentials = await readCredentials();
      guard(identity);
      if (!credentials) throw new AppError('NOT_LOGGED_IN');
      if (session && session.profile.matricula !== credentials.matricula) {
        throw new AppError('SESSION_CHANGED');
      }
      try {
        // An expired authenticated request can itself set an anonymous cookie.
        // Wait for concurrent responses before bootstrapping a clean login;
        // otherwise their late Set-Cookie can overwrite the new login cookie.
        await Promise.allSettled(activeRequests);
        guard(identity);
        await clearCookies();
        guard(identity);
        return await authenticateWithRecovery(credentials, identity);
      } catch (error) {
        if (identity === identityGeneration) session = null;
        throw error;
      }
    })();
    inFlightRefresh = task;
    // Do not let a late refresh erase the next identity's in-flight promise.
    void task
      .finally(() => {
        if (inFlightRefresh === task) inFlightRefresh = null;
      })
      .catch(() => undefined);
    return task;
  }

  async function sendOperation(
    snapshot: Session,
    operation: PortalOperation,
    params: PortalOperationParams,
    identity: number,
    signal?: AbortSignal,
  ): Promise<PortalPage> {
    guard(identity, signal);
    if (inFlightRefresh) {
      await inFlightRefresh;
      guard(identity, signal);
      if (session !== snapshot) throw new AppError('SESSION_CHANGED');
    }
    const requisition = operationKeys[operation]
      .map(key => snapshot.dictionary[key])
      .find(Boolean);
    if (!requisition) throw new AppError('SESSION_EXPIRED');
    const response = await request(
      identity,
      '/requisicaoaluno/',
      {
        controle: operation === 'partialRid' ? 'Rid' : 'Aluno',
        requisicao: requisition,
        _token: snapshot.token,
        ...(params.subjectId
          ? { 'disciplinas[0]': params.subjectId.split('-').pop() }
          : {}),
      },
      signal,
    );
    if (session !== snapshot) throw new AppError('SESSION_CHANGED');
    const $ = loadHtml(response.body);
    if (
      [401, 403, 419, 500].includes(response.status) ||
      isSessionExpiredResponse(response.body, $)
    ) {
      throw new AppError('SESSION_EXPIRED');
    }
    checkStatus(response);
    return { html: response.body, $ };
  }

  async function fetchPage(
    operation: PortalOperation,
    params: PortalOperationParams = {},
    options: AcademicRequestOptions = {},
  ): Promise<PortalPage> {
    const identity = identityGeneration;
    guard(identity, options.signal);
    await cleanup;
    guard(identity, options.signal);
    if (inFlightRefresh) await inFlightRefresh;
    else if (!session) await refresh();
    guard(identity, options.signal);

    // One replay budget covers both derived-ID resolution and the actual
    // academic request. Neither parsers nor transports repeat authentication.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = session;
      if (!snapshot) throw new AppError('NOT_LOGGED_IN');
      try {
        if (
          operation === 'subjectDetails' &&
          !snapshot.dictionary.DadosDisciplina
        ) {
          const curriculum = await sendOperation(
            snapshot,
            'curriculum',
            {},
            identity,
            options.signal,
          );
          const derived = parse(parseSubjectInfoReqId, curriculum.$);
          if (!derived) throw new AppError('PORTAL_LAYOUT_CHANGED');
          guard(identity, options.signal);
          if (session !== snapshot) throw new AppError('SESSION_CHANGED');
          snapshot.dictionary.DadosDisciplina = derived;
        }
        const page = await sendOperation(
          snapshot,
          operation,
          params,
          identity,
          options.signal,
        );
        guard(identity, options.signal);
        return page;
      } catch (error) {
        guard(identity, options.signal);
        const sessionError =
          error instanceof AppError &&
          ['SESSION_EXPIRED', 'SESSION_CHANGED'].includes(error.code);
        if (!sessionError || attempt > 0) throw error;
        if (session === snapshot) await refresh();
        guard(identity, options.signal);
      }
    }
    throw new AppError('SESSION_EXPIRED');
  }

  async function read<T>(
    operation: PortalOperation,
    parser: ($: CheerioAPI) => T,
    options?: AcademicRequestOptions,
    params?: PortalOperationParams,
  ) {
    const identity = identityGeneration;
    if (operation === 'subjectDetails' && !params?.subjectId?.trim()) {
      throw new AppError('INVALID_INPUT');
    }
    const { $ } = await fetchPage(operation, params, options);
    guard(identity, options?.signal);
    return parse(parser, $);
  }

  const authentication: AuthenticationPort = {
    async signIn(credentials) {
      const barrier = invalidateIdentity();
      const identity = identityGeneration;
      await barrier;
      guard(identity);
      return authenticateWithRecovery(credentials, identity);
    },
    refresh,
    signOut: invalidateIdentity,
  };

  const records: AcademicRecordsPort = {
    getGrades: options => read('grades', parseClassGrades, options),
    getHistory: options => read('history', parseSubjectsTaken, options),
    getCurriculum: options =>
      read('curriculum', parseCurriculumSubjects, options),
    getSchedule: options =>
      read('schedule', parseAttendedClassesSchedule, options),
    getPartialRid: options => read('partialRid', parsePartialRID, options),
    getSubjectDetails: (subjectId, options) =>
      read('subjectDetails', parseSubjectInfo, options, { subjectId }),
    getUniversalSubjects: options =>
      read('universalSubjects', parseUniversalSubjects, options),
  };

  return {
    authentication,
    records,
    diagnostics: {
      async fetch(...args: Parameters<typeof fetchPage>) {
        return (await fetchPage(...args)).html;
      },
      snapshot: () => ({
        identityGeneration,
        sessionGeneration: session?.generation ?? null,
        operations: Object.keys(session?.dictionary ?? {}),
      }),
    },
  };
}
