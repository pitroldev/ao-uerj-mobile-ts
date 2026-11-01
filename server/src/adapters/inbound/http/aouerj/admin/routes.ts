import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

import type { ErrorReports } from '../../../../../modules/reports/ports.ts';
import type { Suggestions } from '../../../../../modules/suggestions/ports.ts';
import { UnavailableError } from '../../../../../shared/errors.ts';
import type { AdminSession } from '../../adminSession.ts';
import { notFound } from '../../errors.ts';
import type { Html } from './html.ts';
import {
  diagnosticPage,
  filterFromQuery,
  loginPage,
  messagePage,
  reportsPage,
  reviewUrl,
  suggestionsPage,
} from './views.ts';

/**
 * O anexo da 1.x (a página do portal, que veio de fora) abre isolado: sem
 * script, numa origem própria e sem buscar nada na rede. Não lê o cookie nem
 * as outras páginas da administração.
 */
const SANDBOXED =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/**
 * A administração no navegador (`/aouerj/admin`): o login por token, que
 * grava o cookie, a triagem dos relatos e as sugestões. Sem o ADMIN_TOKEN,
 * nada disto existe (404), como as listagens em JSON.
 */
export function adminRoutes({
  reports,
  suggestions,
  session,
  isDatabaseReady,
  loginLimit,
  now = () => new Date(),
}: {
  reports: ErrorReports;
  suggestions: Suggestions;
  session: AdminSession | null;
  isDatabaseReady: () => boolean;
  loginLimit: RequestHandler;
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

  /** Sem o token configurado, a administração não existe. */
  const configured: RequestHandler = (req, res, next) => {
    if (session) next();
    else notFound(req, res);
  };

  /** Sem o login, a página de entrar (com o 401). */
  const signedIn: RequestHandler = (req, res, next) => {
    if (session!.allows(req)) next();
    else send(res, 401, loginPage({ base: req.baseUrl, failed: false }));
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

  const notThere = (req: Request, res: Response) =>
    send(
      res,
      404,
      messagePage({
        base: req.baseUrl,
        title: 'Não encontrado',
        text: 'Esse relato ou anexo não existe mais.',
        csrf: session!.csrf,
      }),
    );

  routes.get(
    '/admin',
    configured,
    signedIn,
    withDatabase,
    page(async (req, res) => {
      const filter = filterFromQuery(req.query);
      const [review, suggested] = await Promise.all([
        reports.review(filter),
        suggestions.listRecent(),
      ]);
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
      const [suggested, review] = await Promise.all([
        suggestions.listRecent(),
        reports.summarize(),
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
        }),
      );
    }),
  );

  routes.post('/admin/entrar', configured, loginLimit, form, (req, res) => {
    const token = (req.body as Record<string, unknown>)?.token;
    if (!session!.isToken(token)) {
      send(res, 401, loginPage({ base: req.baseUrl, failed: true }));
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
