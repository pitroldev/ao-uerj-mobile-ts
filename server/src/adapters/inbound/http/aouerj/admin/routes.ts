import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';

import type { CampusNow } from '../../../../../modules/campus-now/ports.ts';
import type { Companion } from '../../../../../modules/companion/ports.ts';
import type { ErrorReports } from '../../../../../modules/reports/ports.ts';
import {
  BAN_DAYS,
  STUDENT_LIMITS,
  type BanDays,
} from '../../../../../modules/students/domain.ts';
import type { StudentIdentity } from '../../../../../modules/students/ports.ts';
import type { Suggestions } from '../../../../../modules/suggestions/ports.ts';
import { UnavailableError } from '../../../../../shared/errors.ts';
import type { AdminSession } from '../../adminSession.ts';
import { notFound } from '../../errors.ts';
import type { Html } from './html.ts';
import {
  campusPage,
  COMPANION_STATS_DAYS,
  companionPage,
  diagnosticPage,
  filterFromQuery,
  loginPage,
  messagePage,
  reportsPage,
  reviewUrl,
  studentPage,
  studentsPage,
  suggestionsPage,
} from './views.ts';

/**
 * O anexo da 1.x (a página do portal, que veio de fora) abre isolado: sem
 * script, numa origem própria e sem buscar nada na rede. Não lê o cookie nem
 * as outras páginas da administração.
 */
const SANDBOXED =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** As denúncias da Companhia agora que a página mostra (30 dias). */
const COMPANION_REPORTS_PAGE = 300;

/** Tentativas erradas de login por IP antes de esperar (o token tem 192 bits). */
export const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * A administração no navegador (`/aouerj/admin`): o login por token, que
 * grava o cookie, a triagem dos relatos e as sugestões. Sem o ADMIN_TOKEN,
 * nada disto existe (404), como as listagens em JSON.
 */
export function adminRoutes({
  reports,
  suggestions,
  companion,
  campusNow,
  students,
  session,
  isDatabaseReady,
  now = () => new Date(),
}: {
  reports: ErrorReports;
  suggestions: Suggestions;
  /** As denúncias e os números da Companhia agora, e tirar uma chamada do ar. */
  companion: Pick<
    Companion,
    'reportsForReview' | 'statsForReview' | 'hideByModerator'
  >;
  /** Os avisos de Agora no campus: ver, tirar do ar e voltar ao ar. */
  campusNow: Pick<
    CampusNow,
    'moderation' | 'pendingFlags' | 'removeByModerator' | 'restoreByModerator'
  >;
  /** Os alunos identificados: abrir, banir e desbanir. */
  students: StudentIdentity;
  session: AdminSession | null;
  isDatabaseReady: () => boolean;
  now?: () => Date;
}) {
  const routes = express.Router();
  const form = express.urlencoded({ extended: false, limit: '4kb' });

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

  /** Sem o banco, uma página que diz isso, em vez do 503 em JSON. */
  const withDatabase: RequestHandler = (req, res, next) => {
    if (isDatabaseReady()) next();
    else
      send(
        res,
        503,
        messagePage({
          base: req.baseUrl,
          title: 'Banco fora do ar',
          text: 'O servidor ainda não conectou ao MongoDB. Tente de novo em alguns segundos.',
          csrf: session!.csrf,
        }),
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
          text: 'Esse formulário não veio desta página. Abra os relatos de novo e repita.',
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
          send(
            res,
            503,
            messagePage({
              base: req.baseUrl,
              title: 'Banco fora do ar',
              text: 'A conexão com o MongoDB caiu agora há pouco. Tente de novo em alguns segundos.',
              csrf: session!.csrf,
            }),
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

  routes.get(
    '/admin',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const filter = filterFromQuery(req.query);
      const [review, suggested, flagged, campusFlags] = await Promise.all([
        reports.review(filter),
        suggestions.listRecent(),
        companion.reportsForReview(COMPANION_REPORTS_PAGE),
        campusNow.pendingFlags(),
      ]);
      const people = await students.describe(
        review.reports.flatMap(report =>
          report.studentId ? [report.studentId] : [],
        ),
      );
      send(
        res,
        200,
        reportsPage({
          base: req.baseUrl,
          review,
          filter,
          csrf: session!.csrf,
          now: now(),
          suggestions: suggested.length,
          companionReports: flagged.length,
          campusFlags,
          people,
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
      const [suggested, review, flagged, campusFlags] = await Promise.all([
        suggestions.listRecent(),
        reports.summarize(),
        companion.reportsForReview(COMPANION_REPORTS_PAGE),
        campusNow.pendingFlags(),
      ]);
      send(
        res,
        200,
        suggestionsPage({
          base: req.baseUrl,
          suggestions: suggested,
          csrf: session!.csrf,
          now: now(),
          openReports: review.open,
          companionReports: flagged.length,
          campusFlags,
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
      const [flagged, stats, review, suggested, campusFlags] =
        await Promise.all([
          companion.reportsForReview(COMPANION_REPORTS_PAGE),
          companion.statsForReview(COMPANION_STATS_DAYS),
          reports.summarize(),
          suggestions.listRecent(),
          campusNow.pendingFlags(),
        ]);
      const done = req.query.feito;
      const people = await students.describe(
        flagged.flatMap(report => [
          ...report.people.flatMap(person =>
            person.student ? [person.student] : [],
          ),
          ...(report.reporterStudent ? [report.reporterStudent] : []),
        ]),
      );
      send(
        res,
        200,
        companionPage({
          people,
          base: req.baseUrl,
          reports: flagged,
          stats,
          csrf: session!.csrf,
          now: now(),
          openReports: review.open,
          suggestions: suggested.length,
          campusFlags,
          done:
            done === 'tirada' ? 'hidden' : done === 'acabou' ? 'gone' : null,
        }),
      );
    }),
  );

  // a moderação tira do ar uma chamada denunciada (a de fora não tira sozinha)
  routes.post(
    '/admin/companhia/:callId/tirar',
    configured,
    signedIn,
    form,
    fromThePage,
    withDatabase,
    page(async (req, res) => {
      const result = await companion.hideByModerator(String(req.params.callId));
      res.redirect(
        303,
        `${req.baseUrl}/admin/companhia?feito=${result === 'hidden' ? 'tirada' : 'acabou'}`,
      );
    }),
  );

  /** As contagens das abas, para as páginas dos alunos. */
  const tabCounts = async () => {
    const [review, suggested, flagged, campus] = await Promise.all([
      reports.summarize(),
      suggestions.listRecent(),
      companion.reportsForReview(COMPANION_REPORTS_PAGE),
      campusNow.pendingFlags(),
    ]);
    return {
      open: review.open,
      suggestions: suggested.length,
      companion: flagged.length,
      campus,
    };
  };

  routes.get(
    '/admin/agora',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const [counts, moderation] = await Promise.all([
        tabCounts(),
        campusNow.moderation(),
      ]);
      const people = await students.describe([
        ...moderation.flagged.map(notice => notice.reporter),
        ...moderation.recent.map(notice => notice.reporter),
      ]);
      const done = req.query.feito;
      send(
        res,
        200,
        campusPage({
          base: req.baseUrl,
          csrf: session!.csrf,
          now: now(),
          counts,
          moderation,
          people,
          done:
            done === 'tirado'
              ? 'removed'
              : done === 'mantido'
                ? 'restored'
                : done === 'sumiu'
                  ? 'gone'
                  : null,
        }),
      );
    }),
  );

  // tirar do ar (quem avisou perde os pontos) e voltar ao ar (devolve)
  for (const [action, apply] of [
    ['tirar', (id: string) => campusNow.removeByModerator(id)],
    ['voltar', (id: string) => campusNow.restoreByModerator(id)],
  ] as const) {
    routes.post(
      `/admin/agora/:id/${action}`,
      configured,
      signedIn,
      form,
      fromThePage,
      withDatabase,
      page(async (req, res) => {
        const result = await apply(String(req.params.id));
        const done =
          result === 'removed'
            ? 'tirado'
            : result === 'restored'
              ? 'mantido'
              : 'sumiu';
        res.redirect(303, `${req.baseUrl}/admin/agora?feito=${done}`);
      }),
    );
  }

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

  /** A aba dos alunos, com o resultado da busca se houver. */
  const showStudents = async (req: Request, res: Response, query: string) => {
    const [counts, found, banned, recent] = await Promise.all([
      tabCounts(),
      query ? students.findByMatricula(query) : Promise.resolve(undefined),
      students.banned(100),
      students.recent(20),
    ]);
    send(
      res,
      200,
      studentsPage({
        base: req.baseUrl,
        csrf: session!.csrf,
        now: now(),
        counts,
        query,
        found,
        banned,
        recent,
      }),
    );
  };

  routes.get(
    '/admin/alunos',
    configured,
    signedIn,
    withDatabase,
    identityOn,
    page((req, res) => showStudents(req, res, '')),
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
    page((req, res) => {
      const typed = (req.body as Record<string, unknown>).matricula;
      return showStudents(
        req,
        res,
        typeof typed === 'string' ? typed.replace(/\D/g, '').slice(0, 15) : '',
      );
    }),
  );

  routes.get(
    '/admin/alunos/:id',
    configured,
    signedIn,
    withDatabase,
    identityOn,
    page(async (req, res) => {
      const [counts, student] = await Promise.all([
        tabCounts(),
        students.find(String(req.params.id)),
      ]);
      if (!student) {
        noStudent(req, res);
        return;
      }
      const done = req.query.feito;
      send(
        res,
        200,
        studentPage({
          base: req.baseUrl,
          csrf: session!.csrf,
          now: now(),
          counts,
          student,
          done:
            done === 'banido'
              ? 'banned'
              : done === 'desbanido'
                ? 'unbanned'
                : null,
        }),
      );
    }),
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
      const banned = await students.ban(id, days, reason);
      if (!banned) {
        noStudent(req, res);
        return;
      }
      res.redirect(
        303,
        `${req.baseUrl}/admin/alunos/${encodeURIComponent(id)}?feito=banido`,
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
        `${req.baseUrl}/admin/alunos/${encodeURIComponent(id)}?feito=desbanido`,
      );
    }),
  );

  routes.post('/admin/entrar', configured, loginLimit, form, (req, res) => {
    const token = (req.body as Record<string, unknown>)?.token;
    if (!session!.isToken(token)) {
      send(res, 401, loginPage({ base: req.baseUrl, notice: 'failed' }));
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

  for (const [action, resolved] of [
    ['resolver', true],
    ['reabrir', false],
  ] as const) {
    routes.post(
      `/admin/relatos/:id/${action}`,
      configured,
      signedIn,
      form,
      fromThePage,
      withDatabase,
      page(async (req, res) => {
        const id = String(req.params.id);
        const updated = await reports.setResolved(id, resolved);
        if (!updated) {
          notThere(req, res);
          return;
        }
        // volta para o mesmo recorte; reaberto num recorte que o mostra, no lugar dele
        const filter = filterFromQuery(req.body as Record<string, unknown>);
        const stays =
          filter.status === 'all' || (filter.status === 'open') !== resolved;
        res.redirect(
          303,
          reviewUrl(req.baseUrl, filter, stays ? `#relato-${updated.id}` : ''),
        );
      }),
    );
  }

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
