import { readFileSync } from 'node:fs';

import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';

import type { CampusNow } from '../../../../../modules/campus-now/ports.ts';
import type { Companion } from '../../../../../modules/companion/ports.ts';
import type { PortalStatus } from '../../../../../modules/portal/domain.ts';
import type { ErrorReports } from '../../../../../modules/reports/ports.ts';
import {
  BAN_DAYS,
  STUDENT_LIMITS,
  type BanDays,
  type Student,
} from '../../../../../modules/students/domain.ts';
import type { StudentIdentity } from '../../../../../modules/students/ports.ts';
import type { Suggestions } from '../../../../../modules/suggestions/ports.ts';
import { UnavailableError } from '../../../../../shared/errors.ts';
import type { AdminSession } from '../../adminSession.ts';
import { notFound } from '../../errors.ts';
import type { Release } from '../status.ts';
import { CAMPUS_TABS, campusPage, type CampusTab } from './campusView.ts';
import {
  COMPANION_STATS_DAYS,
  COMPANION_TABS,
  companionPage,
  type CompanionTab,
} from './companionView.ts';
import { tabHref, type PageContext } from './context.ts';
import {
  callCases,
  campusAsks,
  campusDone,
  decidedCases,
  sideCounts,
  studentFacts,
  type Desk,
} from './desk.ts';
import { DAY_MS, excerpt, hour, nameCase } from './format.ts';
import { html, type Html } from './html.ts';
import { homePage, portalTrouble, statusPage } from './homeView.ts';
import { callTitle, groupTitle, noticeTitle, REASON_LABEL } from './labels.ts';
import { icon } from './pieces.ts';
import { REPORTS_TABS, reportsPage, type ReportsTab } from './reportsView.ts';
import { ADMIN_SCRIPT } from './script.ts';
import {
  AREAS,
  areaHref,
  ORDER_OF,
  type AreaKey,
  type Flash,
  type PaletteEntry,
} from './shell.ts';
import {
  STUDENTS_TABS,
  studentsPage,
  type StudentHistory,
  type StudentsTab,
} from './studentsView.ts';
import {
  SUGGESTIONS_TABS,
  suggestionsPage,
  type SuggestionsTab,
} from './suggestionsView.ts';
import { diagnosticPage, loginPage, messagePage } from './views.ts';

/**
 * O anexo da 1.x (a página do portal, que veio de fora) abre isolado: sem
 * script, numa origem própria e sem buscar nada na rede. Não lê o cookie nem
 * as outras páginas da administração.
 */
const SANDBOXED =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** As denúncias da Companhia agora que a administração junta (30 dias). */
const COMPANION_REPORTS_PAGE = 300;
/** Os banidos e os recentes que a área dos alunos lista. */
const STUDENTS_PAGE = 100;
const RECENT_STUDENTS = 30;

/** Tentativas erradas de login por IP antes de esperar (o token tem 192 bits). */
export const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** As fontes servidas (Inter, OFL), lidas uma vez. */
const FONTS = new Map(
  ['inter-regular', 'inter-medium', 'inter-semibold'].map(name => [
    `${name}.woff2`,
    readFileSync(new URL(`./fonts/${name}.woff2`, import.meta.url)),
  ]),
);

const textOf = (value: unknown, max = 80) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;
const tabOf = <T extends string>(
  value: unknown,
  tabs: readonly T[],
  fallback: T,
): T => (tabs.includes(value as T) ? (value as T) : fallback);

/**
 * A administração no navegador (`/aouerj/admin`): uma área para cada coisa
 * (a Companhia agora, Agora no campus e os alunos; os relatos e as
 * sugestões; o status), com o login por token, que grava o cookie. Sem o
 * ADMIN_TOKEN, nada disto existe (404), como as listagens em JSON.
 */
export function adminRoutes({
  reports,
  suggestions,
  companion,
  campusNow,
  students,
  session,
  isDatabaseReady,
  databaseStatus = () => (isDatabaseReady() ? 'connected' : 'disconnected'),
  portal = {
    snapshot: () => ({ state: 'unknown', since: null, checkedAt: null }),
  },
  release = { commit: null, color: null },
  now = () => new Date(),
}: {
  reports: ErrorReports;
  suggestions: Suggestions;
  /** As denúncias, o que está no ar e os números da Companhia agora. */
  companion: Pick<
    Companion,
    | 'reportsForReview'
    | 'statsForReview'
    | 'hideByModerator'
    | 'keepByModerator'
    | 'reopenReview'
    | 'listedForReview'
  >;
  /** Os avisos de Agora no campus: ver, tirar do ar e voltar ao ar. */
  campusNow: Pick<
    CampusNow,
    'moderation' | 'noticesBy' | 'removeByModerator' | 'restoreByModerator'
  >;
  /** Os alunos identificados: abrir, banir e desbanir. */
  students: StudentIdentity;
  session: AdminSession | null;
  isDatabaseReady: () => boolean;
  databaseStatus?: () => string;
  portal?: { snapshot(): PortalStatus };
  release?: Release;
  now?: () => Date;
}) {
  const routes = express.Router();
  const form = express.urlencoded({ extended: false, limit: '4kb' });
  const startedAt = new Date(Date.now() - process.uptime() * 1000);

  const send = (res: Response, status: number, page: Html) => {
    res
      .status(status)
      .set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' })
      .type('html')
      .send(page.value);
  };

  // só as tentativas erradas contam: quem acerta não espera
  const loginLimit = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_ATTEMPTS,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      send(res, 429, loginPage({ base: req.baseUrl, notice: 'limited' }));
    },
  });

  /** Sem o token configurado, a administração não existe. */
  const configured: RequestHandler = (req, res, next) => {
    if (session) next();
    else notFound(req, res);
  };

  /** Sem o login, a página de entrar (com o 401). */
  const signedIn: RequestHandler = (req, res, next) => {
    if (session!.allows(req)) next();
    else send(res, 401, loginPage({ base: req.baseUrl, notice: null }));
  };

  const databaseOut = (req: Request, res: Response, text: string) =>
    send(
      res,
      503,
      messagePage({
        base: req.baseUrl,
        title: 'Banco fora do ar',
        text,
        csrf: session!.csrf,
        retry: true,
      }),
    );

  /** Sem o banco, uma página que diz isso, em vez do 503 em JSON. */
  const withDatabase: RequestHandler = (req, res, next) => {
    if (isDatabaseReady()) next();
    else
      databaseOut(
        req,
        res,
        'O servidor ainda não conectou ao MongoDB. Tente de novo em alguns segundos.',
      );
  };

  /** Os formulários que gravam levam o `csrf` da página. */
  const fromThePage: RequestHandler = (req, res, next) => {
    if (session!.isCsrf((req.body as Record<string, unknown>)?.csrf)) next();
    else
      send(
        res,
        403,
        messagePage({
          base: req.baseUrl,
          title: 'Página vencida',
          text: 'Esse formulário não veio desta página. Abra a área de novo e repita.',
          csrf: session!.csrf,
        }),
      );
  };

  /** Uma queda do banco no meio vira a mesma página do banco fora do ar. */
  const page =
    (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req: Request, res: Response, next: NextFunction) => {
      handler(req, res).catch((err: unknown) => {
        if (err instanceof UnavailableError)
          databaseOut(
            req,
            res,
            'A conexão com o MongoDB caiu agora há pouco. Tente de novo em alguns segundos.',
          );
        else next(err);
      });
    };

  const notThere = (
    req: Request,
    res: Response,
    text = 'Esse relato ou anexo não existe mais.',
  ) =>
    send(
      res,
      404,
      messagePage({
        base: req.baseUrl,
        title: 'Não encontrado',
        text,
        csrf: session!.csrf,
      }),
    );
  const noStudent = (req: Request, res: Response) =>
    notThere(req, res, 'Esse aluno não entrou no app (ou o id está errado).');

  /** Sem a `STUDENT_DATA_KEY`, as páginas dos alunos dizem isso. */
  const identityOn: RequestHandler = (req, res, next) => {
    if (students.available()) next();
    else
      send(
        res,
        503,
        messagePage({
          base: req.baseUrl,
          title: 'Identificação desligada',
          text: 'Falta a STUDENT_DATA_KEY no .env do servidor. Sem ela, ninguém entra pela matrícula e não dá para abrir nem banir alunos.',
          csrf: session!.csrf,
        }),
      );
  };

  /* ------------------------------------------------------------- o quadro */

  async function loadDesk(): Promise<Desk> {
    const time = now();
    const [callReports, listed, moderation, open, suggested, banned] =
      await Promise.all([
        companion.reportsForReview(COMPANION_REPORTS_PAGE),
        companion.listedForReview(),
        campusNow.moderation(),
        reports.groups('open'),
        suggestions.listRecent(),
        students.available()
          ? students.banned(STUDENTS_PAGE)
          : Promise.resolve([] as Student[]),
      ]);
    const cases = callCases(callReports, listed, time);
    return {
      now: time,
      companion: {
        cases,
        asks: cases
          .filter(item => item.pending)
          .sort(
            (a, b) =>
              b.latest.createdAt.getTime() - a.latest.createdAt.getTime(),
          ),
        listed,
        done: decidedCases(cases, time),
      },
      campus: {
        moderation,
        asks: campusAsks(moderation, time),
        done: campusDone(moderation, time),
      },
      reports: open,
      suggestions: {
        fresh: suggested.filter(item => !item.archivedAt),
        archived: suggested
          .filter(item => item.archivedAt)
          .sort((a, b) => b.archivedAt!.getTime() - a.archivedAt!.getTime()),
      },
      banned,
    };
  }

  /** O "Ir para": as áreas e o que cada uma tem agora. */
  function paletteFor(base: string, desk: Desk): PaletteEntry[] {
    const entries: PaletteEntry[] = (Object.keys(AREAS) as AreaKey[]).map(
      area => ({
        group: 'Áreas',
        label: AREAS[area].label,
        meta: `tecla ${ORDER_OF(area)}`,
        href: areaHref(base, area),
        top: true,
      }),
    );
    for (const item of desk.companion.asks)
      entries.push({
        group: 'Companhia agora',
        label: `${REASON_LABEL[item.latest.reason]}: ${callTitle(item.latest)}`,
        meta: 'pede você',
        href: tabHref(base, 'companhia', 'fila', 'fila', item.callId),
        top: true,
      });
    for (const call of desk.companion.listed)
      if (!desk.companion.asks.some(item => item.callId === call.id))
        entries.push({
          group: 'Companhia agora',
          label: callTitle(call),
          meta: 'no ar',
          href: tabHref(base, 'companhia', 'noar', 'fila', call.id),
        });
    for (const notice of desk.campus.asks)
      entries.push({
        group: 'Agora no campus',
        label: noticeTitle(notice),
        meta: 'pede você',
        href: tabHref(base, 'agora', 'fila', 'fila', notice.id),
        top: true,
      });
    for (const notice of desk.campus.moderation.live)
      if (!desk.campus.asks.includes(notice))
        entries.push({
          group: 'Agora no campus',
          label: noticeTitle(notice),
          meta: 'valendo',
          href: tabHref(base, 'agora', 'noar', 'fila', notice.id),
        });
    desk.reports.forEach((group, index) =>
      entries.push({
        group: 'Relatos',
        label: groupTitle(group),
        meta: `×${group.reports.length}`,
        href: tabHref(base, 'relatos', 'fila', 'fila', group.key),
        top: index < 5,
      }),
    );
    for (const suggestion of desk.suggestions.fresh)
      entries.push({
        group: 'Sugestões',
        label: excerpt(suggestion.content, 70),
        meta: 'nova',
        href: tabHref(base, 'sugestoes', 'fila', 'fila', suggestion.id),
      });
    for (const student of desk.banned)
      entries.push({
        group: 'Alunos',
        label: nameCase(student.name),
        meta: 'banido',
        href: `${areaHref(base, 'alunos')}/${encodeURIComponent(student.id)}`,
      });
    return entries;
  }

  /** A faixa do portal fora do ar, onde ela importa. */
  function bannerFor(area: AreaKey, portalNow: PortalStatus): Html | null {
    if (
      !portalTrouble(portalNow) ||
      !['inicio', 'relatos', 'status'].includes(area)
    )
      return null;
    return html`<div class="banner">
      ${icon('warning', true)}<span
        ><b
          >O Aluno Online está fora do
          ar${portalNow.since ? ` desde ${hour(new Date(portalNow.since))}` : ''}.</b
        >
        Os relatos de "portal fora do ar" que chegarem agora são
        esperados.</span
      >
    </div>`;
  }

  async function contextFor(
    req: Request,
    area: AreaKey,
    desk: Desk,
    peopleIds: readonly string[] = [],
  ): Promise<PageContext> {
    const portalNow = portal.snapshot();
    const people =
      students.available() && peopleIds.length
        ? await students.describe([...new Set(peopleIds)])
        : new Map<string, Student>();
    return {
      base: req.baseUrl,
      csrf: session!.csrf,
      now: desk.now,
      desk,
      counts: sideCounts(desk, portalTrouble(portalNow)),
      palette: paletteFor(req.baseUrl, desk),
      flash: flashFor(req, area),
      banner: bannerFor(area, portalNow),
      people,
      facts: studentFacts(desk),
    };
  }

  /** O aviso de depois de uma ação (`?feito=`), com o "Desfazer" quando dá. */
  function flashFor(req: Request, area: AreaKey): Flash | null {
    const done = textOf(req.query.feito, 30);
    if (!done) return null;
    const ref = textOf(req.query.ref, 64) ?? '';
    const n = Number(textOf(req.query.n, 6)) || 1;
    const admin = `${req.baseUrl}/admin`;
    const id = encodeURIComponent(ref);
    const flashes: Partial<Record<AreaKey, Record<string, Flash>>> = {
      companhia: {
        tirada: { text: 'Saiu do ar', sub: 'quem estava dentro vê que acabou' },
        mantida: {
          text: 'Fica no ar',
          sub: 'a denúncia foi arquivada',
          undo: { action: `${admin}/companhia/${id}/reabrir` },
        },
        devolvida: { text: 'A denúncia voltou para você' },
        acabou: { text: 'Já tinha acabado ou saído do ar', error: true },
      },
      agora: {
        tirado: {
          text: 'Saiu do ar',
          sub: 'quem avisou perdeu os pontos',
          undo: {
            action: `${admin}/agora/${id}/voltar`,
            fields: { como: 'voltar' },
          },
        },
        mantido: {
          text: 'Fica no ar',
          sub: 'as denúncias não o tiram mais sozinhas',
        },
        fora: {
          text: 'Fica fora do ar',
          sub: 'quem avisou não recebe os pontos',
        },
        voltou: {
          text: 'Voltou ao ar',
          sub: 'quem avisou recebeu os pontos de volta',
        },
        sumiu: {
          text: 'Esse aviso não existe mais (ou saiu porque quem avisou foi banido)',
          error: true,
        },
      },
      relatos: {
        resolvidos: {
          text: n > 1 ? `${n} relatos resolvidos` : 'Relato resolvido',
          undo: {
            action: `${admin}/relatos/grupos/${id}/reabrir`,
            fields: { em: textOf(req.query.em, 20) ?? '' },
          },
        },
        reabertos: {
          text: n > 1 ? `${n} relatos reabertos` : 'Relato reaberto',
        },
        resolvido: {
          text: 'Relato resolvido',
          undo: { action: `${admin}/relatos/${id}/reabrir` },
        },
        reaberto: { text: 'Relato reaberto' },
      },
      sugestoes: {
        arquivada: {
          text: 'Sugestão arquivada',
          undo: { action: `${admin}/sugestoes/${id}/desarquivar` },
        },
        devolvida: { text: 'Voltou para as novas' },
      },
      alunos: {
        banido: {
          text: 'Banido',
          sub: 'saiu das mesas e grupos',
          undo: { action: `${admin}/alunos/${id}/desbanir` },
        },
        desbanido: { text: 'Desbanido', sub: 'já pode entrar de novo' },
      },
    };
    return flashes[area]?.[done] ?? null;
  }

  /** Para onde voltar depois de uma ação: a aba, o próximo item e o aviso. */
  const backTo = (
    req: Request,
    area: AreaKey,
    tabs: readonly string[],
    defaultTab: string,
    done: string,
    ref: string,
    {
      stay = false,
      extra = {},
    }: { stay?: boolean; extra?: Record<string, string> } = {},
  ) => {
    const fields = req.body as Record<string, unknown>;
    const tab = tabOf(fields.aba, tabs, defaultTab);
    const item = stay ? ref : textOf(fields.proximo, 64);
    return tabHref(req.baseUrl, area, tab, defaultTab, item, {
      feito: done,
      ref,
      ...extra,
    });
  };

  /* ----------------------------------------------------------- o que vai */

  routes.get('/admin/admin.js', configured, (req, res) => {
    res
      .set({ 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' })
      .type('application/javascript')
      .send(ADMIN_SCRIPT);
  });

  routes.get('/admin/fonts/:file', configured, (req, res) => {
    const font = FONTS.get(String(req.params.file));
    if (!font) {
      notFound(req, res);
      return;
    }
    res
      .set({ 'Cache-Control': 'public, max-age=604800' })
      .type('font/woff2')
      .send(font);
  });

  /* ---------------------------------------------------------------- áreas */

  routes.get(
    '/admin',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const desk = await loadDesk();
      send(
        res,
        200,
        homePage(await contextFor(req, 'inicio', desk), {
          portal: portal.snapshot(),
        }),
      );
    }),
  );

  routes.get(
    '/admin/companhia',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const tab = tabOf<CompanionTab>(req.query.aba, COMPANION_TABS, 'fila');
      const [desk, stats] = await Promise.all([
        loadDesk(),
        tab === 'numeros'
          ? companion.statsForReview(COMPANION_STATS_DAYS)
          : Promise.resolve(null),
      ]);
      const ids = desk.companion.cases.flatMap(item =>
        item.reports.flatMap(report => [
          ...report.people.flatMap(person =>
            person.student ? [person.student] : [],
          ),
          ...(report.reporterStudent ? [report.reporterStudent] : []),
        ]),
      );
      send(
        res,
        200,
        companionPage(await contextFor(req, 'companhia', desk, ids), {
          tab,
          item: textOf(req.query.item, 64),
          stats,
        }),
      );
    }),
  );

  routes.get(
    '/admin/agora',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const tab = tabOf<CampusTab>(req.query.aba, CAMPUS_TABS, 'fila');
      const desk = await loadDesk();
      const { moderation } = desk.campus;
      const ids = [
        ...moderation.flagged,
        ...moderation.live,
        ...moderation.recent,
      ].map(notice => notice.reporter);
      send(
        res,
        200,
        campusPage(await contextFor(req, 'agora', desk, ids), {
          tab,
          item: textOf(req.query.item, 64),
        }),
      );
    }),
  );

  routes.get(
    '/admin/relatos',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const tab = tabOf<ReportsTab>(req.query.aba, REPORTS_TABS, 'fila');
      const [desk, resolved, recent] = await Promise.all([
        loadDesk(),
        tab === 'feitos' ? reports.groups('resolved') : Promise.resolve(null),
        tab === 'numeros'
          ? reports.createdSince(new Date(now().getTime() - 14 * DAY_MS))
          : Promise.resolve(null),
      ]);
      const groups = tab === 'feitos' ? (resolved ?? []) : desk.reports;
      const ids = groups.flatMap(group =>
        group.reports.flatMap(report =>
          report.studentId ? [report.studentId] : [],
        ),
      );
      send(
        res,
        200,
        reportsPage(await contextFor(req, 'relatos', desk, ids), {
          tab,
          item: textOf(req.query.item, 64),
          resolved,
          recent,
          showAll: req.query.todos === '1',
        }),
      );
    }),
  );

  routes.get(
    '/admin/sugestoes',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const tab = tabOf<SuggestionsTab>(
        req.query.aba,
        SUGGESTIONS_TABS,
        'fila',
      );
      const desk = await loadDesk();
      send(
        res,
        200,
        suggestionsPage(await contextFor(req, 'sugestoes', desk), {
          tab,
          item: textOf(req.query.item, 64),
        }),
      );
    }),
  );

  routes.get('/admin/status', configured, signedIn, (req, res, next) => {
    const portalNow = portal.snapshot();
    const render = (desk: Desk | null) =>
      send(
        res,
        200,
        statusPage({
          base: req.baseUrl,
          csrf: session!.csrf,
          counts: desk ? sideCounts(desk, portalTrouble(portalNow)) : null,
          portal: portalNow,
          database: { ready: isDatabaseReady(), status: databaseStatus() },
          release,
          startedAt,
          openLayoutGroups: desk
            ? desk.reports.filter(group =>
                Object.values(group.diagnostic?.portalErrors ?? {}).includes(
                  'PORTAL_LAYOUT_CHANGED',
                ),
              ).length
            : 0,
          palette: desk ? paletteFor(req.baseUrl, desk) : undefined,
        }),
      );
    // o status abre mesmo sem o banco: é quando ele mais importa
    if (!isDatabaseReady()) {
      render(null);
      return;
    }
    loadDesk().then(render, (err: unknown) =>
      err instanceof UnavailableError ? render(null) : next(err),
    );
  });

  /* ------------------------------------------------------------- alunos */

  /** O histórico de um aluno, juntando o que os módulos guardam dele. */
  async function historyOf(
    student: Student,
    desk: Desk,
  ): Promise<StudentHistory> {
    const [sent, notices] = await Promise.all([
      reports.byStudent(student.id),
      campusNow.noticesBy(student.id),
    ]);
    const all = desk.companion.cases.flatMap(item => item.reports);
    return {
      reports: sent,
      notices,
      inCalls: all.filter(report =>
        report.people.some(person => person.student === student.id),
      ),
      made: all.filter(report => report.reporterStudent === student.id),
    };
  }

  /** A volta (um caminho da administração), para o "Voltar" da prévia do aluno. */
  const backOf = (req: Request) => {
    const value = textOf(req.query.volta, 300);
    const prefix = `${req.baseUrl}/admin`;
    return value &&
      value.startsWith(prefix) &&
      !value.includes('//') &&
      !/[\s"'<>\\]/.test(value)
      ? value
      : null;
  };

  async function showStudents(
    req: Request,
    res: Response,
    {
      id,
      query = '',
      found = null,
      status = 200,
    }: { id?: string; query?: string; found?: boolean | null; status?: number },
  ) {
    const tab = tabOf<StudentsTab>(req.query.aba, STUDENTS_TABS, 'banidos');
    const [desk, recent, wanted] = await Promise.all([
      loadDesk(),
      tab === 'recentes'
        ? students.recent(RECENT_STUDENTS)
        : Promise.resolve(null),
      id ? students.find(id) : Promise.resolve(null),
    ]);
    if (id && !wanted) {
      noStudent(req, res);
      return;
    }
    const list = tab === 'recentes' ? (recent ?? []) : desk.banned;
    const student = wanted ?? list[0];
    const history = student ? await historyOf(student, desk) : null;
    send(
      res,
      status,
      studentsPage(await contextFor(req, 'alunos', desk), {
        tab,
        list,
        student,
        history,
        query,
        found,
        back: backOf(req),
      }),
    );
  }

  routes.get(
    '/admin/alunos',
    configured,
    signedIn,
    withDatabase,
    identityOn,
    page((req, res) => showStudents(req, res, {})),
  );

  // a busca vai no corpo, para a matrícula não ficar na URL nem nos logs
  routes.post(
    '/admin/alunos/busca',
    configured,
    signedIn,
    form,
    fromThePage,
    withDatabase,
    identityOn,
    page(async (req, res) => {
      const typed = (req.body as Record<string, unknown>).matricula;
      const query =
        typeof typed === 'string' ? typed.replace(/\D/g, '').slice(0, 15) : '';
      const found = query ? await students.findByMatricula(query) : null;
      if (found) {
        res.redirect(
          303,
          `${areaHref(req.baseUrl, 'alunos')}/${encodeURIComponent(found.id)}?aba=recentes`,
        );
        return;
      }
      await showStudents(req, res, { query, found: query ? false : null });
    }),
  );

  routes.get(
    '/admin/alunos/:id',
    configured,
    signedIn,
    withDatabase,
    identityOn,
    page((req, res) => showStudents(req, res, { id: String(req.params.id) })),
  );

  // banir: o prazo da lista (1, 7, 30 dias ou para sempre) e o motivo
  routes.post(
    '/admin/alunos/:id/banir',
    configured,
    signedIn,
    form,
    fromThePage,
    withDatabase,
    identityOn,
    page(async (req, res) => {
      const fields = req.body as Record<string, unknown>;
      const prazo = typeof fields.prazo === 'string' ? fields.prazo : '';
      const days = (prazo === 'sempre' ? null : Number(prazo)) as BanDays;
      const reason = (typeof fields.motivo === 'string' ? fields.motivo : '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, STUDENT_LIMITS.banReason);
      const id = String(req.params.id);
      // o formulário pede os dois: sem eles, volta para a página do aluno
      if (!BAN_DAYS.includes(days) || !reason) {
        send(
          res,
          400,
          messagePage({
            base: req.baseUrl,
            title: 'Faltou o motivo ou o prazo',
            text: 'Volte à página do aluno e escolha o prazo e o motivo do banimento.',
            csrf: session!.csrf,
          }),
        );
        return;
      }
      if (!(await students.ban(id, days, reason))) {
        noStudent(req, res);
        return;
      }
      res.redirect(
        303,
        `${areaHref(req.baseUrl, 'alunos')}/${encodeURIComponent(id)}?feito=banido&ref=${encodeURIComponent(id)}`,
      );
    }),
  );

  routes.post(
    '/admin/alunos/:id/desbanir',
    configured,
    signedIn,
    form,
    fromThePage,
    withDatabase,
    identityOn,
    page(async (req, res) => {
      const id = String(req.params.id);
      if (!(await students.unban(id))) {
        noStudent(req, res);
        return;
      }
      res.redirect(
        303,
        `${areaHref(req.baseUrl, 'alunos')}/${encodeURIComponent(id)}?aba=recentes&feito=desbanido&ref=${encodeURIComponent(id)}`,
      );
    }),
  );

  /* ----------------------------------------------------------- as ações */

  const action = (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) =>
    routes.post(
      path,
      configured,
      signedIn,
      form,
      fromThePage,
      withDatabase,
      page(handler),
    );

  // a moderação tira do ar uma chamada (a denúncia de fora não tira sozinha)
  action('/admin/companhia/:callId/tirar', async (req, res) => {
    const callId = String(req.params.callId);
    const result = await companion.hideByModerator(callId);
    res.redirect(
      303,
      backTo(
        req,
        'companhia',
        COMPANION_TABS,
        'fila',
        result === 'hidden' ? 'tirada' : 'acabou',
        callId,
      ),
    );
  });

  // deixa no ar: a denúncia fica arquivada
  action('/admin/companhia/:callId/manter', async (req, res) => {
    const callId = String(req.params.callId);
    const result = await companion.keepByModerator(callId);
    const tab = tabOf(
      (req.body as Record<string, unknown>).aba,
      COMPANION_TABS,
      'fila',
    );
    res.redirect(
      303,
      backTo(
        req,
        'companhia',
        COMPANION_TABS,
        'fila',
        result === 'kept' ? 'mantida' : 'acabou',
        callId,
        { stay: tab === 'noar' },
      ),
    );
  });

  action('/admin/companhia/:callId/reabrir', async (req, res) => {
    const callId = String(req.params.callId);
    await companion.reopenReview(callId);
    res.redirect(
      303,
      tabHref(req.baseUrl, 'companhia', 'fila', 'fila', callId, {
        feito: 'devolvida',
        ref: callId,
      }),
    );
  });

  // tirar do ar (quem avisou perde os pontos) e voltar ao ar (devolve)
  action('/admin/agora/:id/tirar', async (req, res) => {
    const id = String(req.params.id);
    const keepOff = (req.body as Record<string, unknown>).como === 'fora';
    const result = await campusNow.removeByModerator(id);
    res.redirect(
      303,
      backTo(
        req,
        'agora',
        CAMPUS_TABS,
        'fila',
        result === 'gone' ? 'sumiu' : keepOff ? 'fora' : 'tirado',
        id,
      ),
    );
  });

  action('/admin/agora/:id/voltar', async (req, res) => {
    const id = String(req.params.id);
    const keep = (req.body as Record<string, unknown>).como === 'manter';
    const result = await campusNow.restoreByModerator(id);
    const tab = tabOf(
      (req.body as Record<string, unknown>).aba,
      CAMPUS_TABS,
      'fila',
    );
    res.redirect(
      303,
      backTo(
        req,
        'agora',
        CAMPUS_TABS,
        'fila',
        result === 'gone' ? 'sumiu' : keep ? 'mantido' : 'voltou',
        id,
        { stay: tab === 'noar' || !keep },
      ),
    );
  });

  // um grupo de relatos inteiro: resolver os abertos, ou reabrir os resolvidos
  action('/admin/relatos/grupos/:key/resolver', async (req, res) => {
    const key = String(req.params.key);
    const group = (await reports.groups('open')).find(item => item.key === key);
    if (!group) {
      notThere(req, res, 'Esse grupo de relatos não tem mais nada aberto.');
      return;
    }
    // o "Desfazer" reabre só estes: os resolvidos na mesma hora
    const { changed, at } = await reports.setResolvedMany(
      group.reports.map(report => report.id),
      true,
    );
    res.redirect(
      303,
      backTo(req, 'relatos', REPORTS_TABS, 'fila', 'resolvidos', key, {
        extra: { n: String(changed), em: String(at?.getTime() ?? '') },
      }),
    );
  });

  action('/admin/relatos/grupos/:key/reabrir', async (req, res) => {
    const key = String(req.params.key);
    const fields = req.body as Record<string, unknown>;
    const group = (await reports.groups('resolved')).find(
      item => item.key === key,
    );
    if (!group) {
      notThere(req, res, 'Esse grupo de relatos não tem nada resolvido.');
      return;
    }
    const since = Number(textOf(fields.em, 20));
    const chosen = group.reports.filter(
      report => !since || report.resolvedAt?.getTime() === since,
    );
    const { changed } = await reports.setResolvedMany(
      chosen.map(report => report.id),
      false,
    );
    const tab = tabOf(fields.aba, REPORTS_TABS, 'fila');
    res.redirect(
      303,
      tabHref(
        req.baseUrl,
        'relatos',
        tab === 'feitos' ? 'feitos' : 'fila',
        'fila',
        tab === 'feitos' ? undefined : key,
        { feito: 'reabertos', ref: key, n: String(changed) },
      ),
    );
  });

  // um relato só (dentro do grupo)
  for (const [path, resolved] of [
    ['resolver', true],
    ['reabrir', false],
  ] as const) {
    action(`/admin/relatos/:id/${path}`, async (req, res) => {
      const id = String(req.params.id);
      const updated = await reports.setResolved(id, resolved);
      if (!updated) {
        notThere(req, res);
        return;
      }
      const fields = req.body as Record<string, unknown>;
      const tab = tabOf(fields.aba, REPORTS_TABS, 'fila');
      res.redirect(
        303,
        tabHref(req.baseUrl, 'relatos', tab, 'fila', textOf(fields.volta, 64), {
          feito: resolved ? 'resolvido' : 'reaberto',
          ref: id,
        }),
      );
    });
  }

  for (const [path, archived] of [
    ['arquivar', true],
    ['desarquivar', false],
  ] as const) {
    action(`/admin/sugestoes/:id/${path}`, async (req, res) => {
      const id = String(req.params.id);
      if (!(await suggestions.setArchived(id, archived))) {
        notThere(req, res, 'Essa sugestão não existe mais.');
        return;
      }
      res.redirect(
        303,
        backTo(
          req,
          'sugestoes',
          SUGGESTIONS_TABS,
          'fila',
          archived ? 'arquivada' : 'devolvida',
          id,
          { stay: !archived },
        ),
      );
    });
  }

  /* ----------------------------------------------------- entrar e sair */

  routes.post('/admin/entrar', configured, loginLimit, form, (req, res) => {
    const token = (req.body as Record<string, unknown>)?.token;
    if (!session!.isToken(token)) {
      const info = (req as Request & { rateLimit?: { remaining?: number } })
        .rateLimit;
      send(
        res,
        401,
        loginPage({
          base: req.baseUrl,
          notice: 'failed',
          remaining: info?.remaining,
        }),
      );
      return;
    }
    res.set('Set-Cookie', session!.login(req));
    res.redirect(303, `${req.baseUrl}/admin`);
  });

  // sair só apaga o cookie: não precisa de mais nada
  routes.post('/admin/sair', configured, (req, res) => {
    res.set('Set-Cookie', session!.logout(req));
    res.redirect(303, `${req.baseUrl}/admin`);
  });

  /* -------------------------------------------------------------- anexos */

  routes.get(
    '/admin/relatos/:id/anexos/:attachment',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const found = await reports.attachment(
        String(req.params.id),
        String(req.params.attachment),
      );
      if (!found) {
        notThere(req, res);
        return;
      }
      if (found.kind === 'diagnostic') {
        send(
          res,
          200,
          diagnosticPage({
            base: req.baseUrl,
            report: found.report,
            diagnostic: found.diagnostic,
            raw: found.raw,
            csrf: session!.csrf,
          }),
        );
        return;
      }
      res
        .status(200)
        .set({
          'Content-Security-Policy': SANDBOXED,
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'Content-Disposition': 'inline',
        })
        .type('html')
        .send(found.html);
    }),
  );

  return routes;
}
