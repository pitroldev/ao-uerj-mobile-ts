import type {
  AcademicRecordsPort,
  AcademicRequestOptions,
} from '@root/modules/academics/application/ports';
import {
  SignInError,
  type AuthenticationPort,
} from '@root/modules/identity/application/ports';
import type {
  DocumentsPort,
  DocumentRequestOptions,
} from '@root/modules/documents/application/ports';
import type {
  StudentDocument,
  DocumentPdf,
} from '@root/modules/documents/domain/models';
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
  PortalRequest,
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
import { parseComplementaryActivities } from './parsers/ComplementaryActivities';
import { parseCurriculumSubjects } from './parsers/CurriculumSubjects';
import { parseAttendedClassesSchedule } from './parsers/AttendedClassesSchedule';
import { parsePartialRID } from './parsers/PartialRID';
import { parseEnrollmentResult } from './parsers/EnrollmentResult';
import { parseSubjectInfo } from './parsers/SubjectInfo';
import { parseUniversalSubjects } from './parsers/UniversalSubjects';
import { parseGraduationSynthesis } from './parsers/GraduationSynthesis';
import {
  parseDocumentCatalog,
  documentFormParams,
  parseDocumentPdfPath,
} from './parsers/Documents';

type Dependencies = {
  transport: PortalTransport;
  cookies: PortalCookieJar;
  readCredentials: () => Promise<Credentials | null>;
  /** A espera entre as tentativas de abrir a sessão (os testes não esperam). */
  wait?: (ms: number) => Promise<void>;
};

/** A response loaded once; session detection and the parser share `$`. */
type PortalPage = { html: string; $: CheerioAPI; session: Session };

type Session = {
  generation: number;
  token: string;
  dictionary: Record<string, string>;
  /** Itens que o menu lista sem requisição ("Acesso temporariamente bloqueado."). */
  blocked: ReadonlySet<string>;
  profile: StudentProfile;
  /** When the login read the menu that filled `dictionary`. */
  readAt: number;
};

/**
 * A menu younger than this is the portal's current answer: a page missing from
 * it is not offered to the account now. An older menu may be outdated (the RID
 * pages come and go with enrollment) and earns one new login.
 */
const FRESH_MENU = 5 * 60 * 1000;
/**
 * O bloqueio do menu vale por menos tempo: quem toca em "Tentar novamente"
 * um minuto depois quer saber se a UERJ já liberou, e isso custa um login.
 */
const FRESH_BLOCK = 60 * 1000;
/** Uma página lida há menos que isto serve à outra leitura da mesma página. */
const SHARED_PAGE_TTL = 15 * 1000;
/**
 * Quando o portal está instável, ele responde a página de erro de sessão
 * ("Página não encontrada!") no lugar do formulário de login, em janelas de
 * segundos a minutos. Em 17/11/2026, depois do fim do bloqueio da inscrição,
 * só 1 em cada 10 a 15 sessões novas abria, e as janelas ruins passavam de
 * 15 s. A abertura recomeça com uma sessão nova, esperando cada vez mais
 * (uns 21 s no total), antes de desistir. Ainda não mandou matrícula nem
 * senha, então insistir não pesa na conta.
 */
const BOOTSTRAP_WAITS = [1000, 2000, 3000, 4000, 5000, 6000];

const operationKeys: Record<PortalOperation, string[]> = {
  grades: ['notas'],
  history: ['DisciplinasRealizadas'],
  curriculum: ['DisciplinasCursar'],
  schedule: ['Disciplinas em Curso', 'DisciplinasCurso'],
  partialRid: ['RidParcial'],
  enrollmentResult: ['RidInscricao'],
  subjectDetails: ['DadosDisciplina'],
  universalSubjects: ['UniversaisCursar'],
  synthesis: ['SinteseFormacao'],
  documents: ['Emissão de Documentos'],
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

/**
 * A failed login (explicit, refresh or the one a read starts by itself) leaves
 * as SignInError with the same code: a caller reading several pages stops
 * instead of signing in again for the next one.
 */
async function signingIn<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (error instanceof AppError && !(error instanceof SignInError))
      throw new SignInError(error.code, error.message);
    throw error;
  }
}

export function createAlunoOnlineAdapter({
  transport,
  cookies,
  readCredentials,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
}: Dependencies) {
  let identityGeneration = 0;
  let sessionGeneration = 0;
  let session: Session | null = null;
  let inFlightRefresh: Promise<StudentProfile> | null = null;
  let cleanup: Promise<void> = Promise.resolve();
  let cookieMutation: Promise<void> = Promise.resolve();
  const activeRequests = new Set<Promise<PortalResponse>>();
  const documentMutations = new Set<number>();

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
    mode: Pick<PortalRequest, 'method' | 'responseType'> = {},
  ) {
    guard(identity, signal);
    try {
      const pending = transport.request({ path, params, signal, ...mode });
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

  /**
   * A raiz (que cria a sessão anônima) e o formulário de login. Sem o
   * formulário, só a página de erro de sessão do portal (ou uma resposta
   * vazia) faz recomeçar; qualquer outra página segue para o parser, que diz
   * se o formato mudou.
   */
  async function openLoginForm(identity: number): Promise<CheerioAPI> {
    for (let attempt = 0; ; attempt += 1) {
      if (attempt > 0) {
        await wait(BOOTSTRAP_WAITS[attempt - 1]);
        guard(identity);
        await clearCookies();
        guard(identity);
      }
      const root = await request(identity, '/');
      checkStatus(root);
      const loginPage = await request(identity, '/requisicaoaluno/');
      checkStatus(loginPage);
      const loginForm = loadHtml(loginPage.body);
      if (
        loginForm('input[name="matricula"], input[name="senha"]').length ||
        !isSessionExpiredResponse(loginPage.body, loginForm)
      )
        return loginForm;
      if (attempt >= BOOTSTRAP_WAITS.length)
        throw new AppError('PORTAL_UNSTABLE');
    }
  }

  async function authenticate(
    credentials: Credentials,
    identity: number,
  ): Promise<StudentProfile> {
    guard(identity);
    if (!credentials.matricula.trim() || !credentials.password) {
      throw new AppError('INVALID_INPUT');
    }
    const loginForm = await openLoginForm(identity);
    let login: { loginReqId: string; _token: string };
    try {
      login = await parseLoginReqId(loginForm);
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
    // Um menu bloqueado (época de inscrição) não é falha de login: a conta
    // entra, e só as páginas bloqueadas respondem POSSIBLY_BLOCKED.
    const { dictionary, blocked } = parse(getReqIds, homePage);
    if (!Object.keys(dictionary).length && !blocked.length)
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
      blocked: new Set(blocked),
      profile,
      readAt: Date.now(),
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
      try {
        return await authenticate(credentials, identity);
      } catch (retryError) {
        // a sessão perdida de novo, logo depois de entrar: é o portal
        // instável, não a conta (e "Sua sessão expirou" não faz sentido no
        // login)
        if (
          retryError instanceof AppError &&
          retryError.code === 'SESSION_EXPIRED'
        )
          throw new AppError('PORTAL_UNSTABLE');
        throw retryError;
      }
    }
  }

  function refresh(): Promise<StudentProfile> {
    if (inFlightRefresh) return inFlightRefresh;
    const identity = identityGeneration;
    const task = signingIn(async () => {
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
    });
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
    if (!requisition) {
      const menuAge = Date.now() - snapshot.readAt;
      // A página está no menu, mas bloqueada pela UERJ. Um bloqueio lido há
      // pouco responde na hora; um mais velho passa por um novo login
      // (SESSION_EXPIRED), que diz se o portal já liberou.
      if (operationKeys[operation].some(key => snapshot.blocked.has(key)))
        throw new AppError(
          menuAge < FRESH_BLOCK ? 'POSSIBLY_BLOCKED' : 'SESSION_EXPIRED',
        );
      if (operation === 'documents') throw new AppError('DOCUMENT_UNAVAILABLE');
      // An outdated menu goes through one new login (SESSION_EXPIRED); a fresh
      // menu without the page means the account cannot open it now.
      throw new AppError(
        menuAge < FRESH_MENU ? 'PAGE_UNAVAILABLE' : 'SESSION_EXPIRED',
      );
    }
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
    return { html: response.body, $, session: snapshot };
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
        if (!sessionError) throw error;
        // a página perdeu a sessão de novo, logo depois de um login novo: o
        // portal está instável (a conta e o login estão bem)
        if (attempt > 0)
          throw error.code === 'SESSION_EXPIRED'
            ? new AppError('PORTAL_UNSTABLE')
            : error;
        if (session === snapshot) await refresh();
        guard(identity, options.signal);
      }
    }
    throw new AppError('SESSION_EXPIRED');
  }

  /**
   * A página do histórico serve a duas leituras: as disciplinas e as
   * atividades complementares. Pedidas juntas, como no Meu Progresso, elas
   * saem de uma requisição só. A busca compartilhada não leva o sinal de
   * nenhuma das duas, para uma desistência não derrubar a outra.
   */
  let sharedHistory: {
    identity: number;
    at: number;
    page: Promise<PortalPage>;
  } | null = null;

  function historyPage(): Promise<PortalPage> {
    const identity = identityGeneration;
    const now = Date.now();
    if (
      !sharedHistory ||
      sharedHistory.identity !== identity ||
      now - sharedHistory.at > SHARED_PAGE_TTL
    ) {
      const entry = { identity, at: now, page: fetchPage('history') };
      sharedHistory = entry;
      entry.page.catch(() => {
        if (sharedHistory === entry) sharedHistory = null;
      });
    }
    return sharedHistory.page;
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
    guard(identity, options?.signal);
    const { $ } =
      operation === 'history'
        ? await historyPage()
        : await fetchPage(operation, params, options);
    guard(identity, options?.signal);
    return parse(parser, $);
  }

  const authentication: AuthenticationPort = {
    signIn: credentials =>
      signingIn(async () => {
        const barrier = invalidateIdentity();
        const identity = identityGeneration;
        await barrier;
        guard(identity);
        return authenticateWithRecovery(credentials, identity);
      }),
    refresh,
    signOut: invalidateIdentity,
  };

  const records: AcademicRecordsPort = {
    getGrades: options => read('grades', parseClassGrades, options),
    getHistory: options => read('history', parseSubjectsTaken, options),
    getComplementaryActivities: options =>
      read('history', parseComplementaryActivities, options),
    getCurriculum: options =>
      read('curriculum', parseCurriculumSubjects, options),
    getSchedule: options =>
      read('schedule', parseAttendedClassesSchedule, options),
    getPartialRid: options => read('partialRid', parsePartialRID, options),
    getEnrollmentResult: options =>
      read('enrollmentResult', parseEnrollmentResult, options),
    getSubjectDetails: (subjectId, options) =>
      read('subjectDetails', parseSubjectInfo, options, { subjectId }),
    getUniversalSubjects: options =>
      read('universalSubjects', parseUniversalSubjects, options),
    getSynthesis: options =>
      read('synthesis', parseGraduationSynthesis, options),
  };

  function checkDocumentResponse(response: PortalResponse, snapshot: Session) {
    if (session !== snapshot) throw new AppError('SESSION_CHANGED');
    const $ = loadHtml(response.body);
    if (
      [401, 403, 419].includes(response.status) ||
      (!response.pdfBase64 && isSessionExpiredResponse(response.body, $))
    ) {
      throw new AppError('SESSION_EXPIRED');
    }
    checkStatus(response);
    return $;
  }

  async function changeDocument(
    operation: 'issue' | 'remove',
    selected: Pick<StudentDocument, 'id' | 'revision'>,
    options: DocumentRequestOptions = {},
  ): Promise<DocumentPdf | void> {
    const identity = identityGeneration;
    guard(identity, options.signal);
    if (!/^\d+:\d+:[\w.-]+$/.test(selected.id))
      throw new AppError('INVALID_INPUT');
    if (documentMutations.has(identity)) throw new AppError('CANCELLED');
    documentMutations.add(identity);
    try {
      // Resolve every action from a fresh catalog: requisitions belong to the
      // current session, and the user may have changed the document on the web.
      const page = await fetchPage('documents', {}, options);
      guard(identity, options.signal);
      const catalog = parse(parseDocumentCatalog, page.$);
      const entry = catalog.entries.find(
        item => item.document.id === selected.id,
      );
      const action = entry?.[operation];
      if (!entry && operation === 'remove')
        throw new AppError('DOCUMENT_CHANGED');
      if (!entry || !action) throw new AppError('DOCUMENT_UNAVAILABLE');
      if (
        operation === 'remove' &&
        (!selected.revision || selected.revision !== entry.document.revision)
      ) {
        throw new AppError('DOCUMENT_CHANGED');
      }
      if (inFlightRefresh) await inFlightRefresh;
      guard(identity, options.signal);
      if (session !== page.session) throw new AppError('SESSION_CHANGED');
      // Never automatically replay a POST: a lost response may already have
      // changed the portal. Only catalog reads have session recovery/replay.
      const response = await request(
        identity,
        '/requisicaoaluno/',
        documentFormParams(action, catalog.token),
        options.signal,
        {
          method: 'POST',
          responseType: operation === 'issue' ? 'pdf' : 'text',
        },
      );
      const $ = checkDocumentResponse(response, page.session);
      if (operation === 'remove') {
        const confirmed = await fetchPage('documents', {}, options);
        guard(identity, options.signal);
        const updated = parse(parseDocumentCatalog, confirmed.$);
        if (
          updated.entries.some(
            item => item.document.revision === selected.revision,
          )
        ) {
          throw new AppError('DOCUMENT_NOT_REMOVED');
        }
        return;
      }
      let pdf = response;
      if (!pdf.pdfBase64) {
        const path = parse(parseDocumentPdfPath, $);
        // A concurrent academic request may have begun refreshing while the
        // POST was in flight. Do not start a new cookie-bearing download after
        // that refresh has already taken its snapshot of active requests.
        if (inFlightRefresh) await inFlightRefresh;
        guard(identity, options.signal);
        if (session !== page.session) throw new AppError('SESSION_CHANGED');
        pdf = await request(identity, path, undefined, options.signal, {
          responseType: 'pdf',
        });
        checkDocumentResponse(pdf, page.session);
      }
      if (!pdf.pdfBase64) throw new AppError('PORTAL_LAYOUT_CHANGED');
      guard(identity, options.signal);
      return {
        base64: pdf.pdfBase64,
        filename: `documento-uerj-${action.option}-${action.subOption}.pdf`,
        mimeType: 'application/pdf',
      };
    } finally {
      documentMutations.delete(identity);
    }
  }

  const documents: DocumentsPort = {
    list: options =>
      read(
        'documents',
        $ => parseDocumentCatalog($).entries.map(entry => entry.document),
        options,
      ),
    async issue(id, options) {
      return (await changeDocument(
        'issue',
        { id, revision: null },
        options,
      )) as DocumentPdf;
    },
    async remove(document, options) {
      await changeDocument('remove', document, options);
    },
  };

  return {
    authentication,
    records,
    documents,
    diagnostics: {
      async fetch(...args: Parameters<typeof fetchPage>) {
        return (await fetchPage(...args)).html;
      },
      snapshot: () => ({
        identityGeneration,
        sessionGeneration: session?.generation ?? null,
        operations: Object.keys(session?.dictionary ?? {}),
        blocked: [...(session?.blocked ?? [])],
      }),
    },
  };
}
