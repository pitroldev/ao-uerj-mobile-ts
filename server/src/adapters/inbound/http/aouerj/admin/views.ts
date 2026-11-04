import {
  FLAGS_TO_REMOVE,
  type Gate,
  type Notice,
  type NoticeKind,
  type NoticeStatus,
  type Place,
} from '../../../../../modules/campus-now/domain.ts';
import type { Moderation } from '../../../../../modules/campus-now/ports.ts';
import {
  MEMBER_REPORTS_TO_HIDE,
  type CallReport,
  type DayStats,
} from '../../../../../modules/companion/domain.ts';
import type {
  Diagnostic,
  ErrorReport,
  ReviewFilter,
  ReviewStatus,
} from '../../../../../modules/reports/domain.ts';
import type {
  AttachmentView,
  Review,
  ReviewedReport,
} from '../../../../../modules/reports/ports.ts';
import {
  isBanned,
  STUDENT_LIMITS,
  type Student,
} from '../../../../../modules/students/domain.ts';
import type { Suggestion } from '../../../../../modules/suggestions/domain.ts';
import { html, trusted, type Html } from './html.ts';
import { ICON_VIEWBOX, ICONS, type IconName } from './icons.ts';
import { AO_LOGO_PATHS, AO_LOGO_VIEWBOX } from './logo.ts';

/*
 * As páginas da administração (`/aouerj/admin`): HTML montado aqui, sem
 * JavaScript, no mundo do app (o azul da UERJ no cabeçalho, o painel claro
 * com o canto superior esquerdo arredondado, os avisos com o canto reto).
 * Segue o tema do sistema, claro ou escuro, com as cores dos temas do app.
 */

const ZONE = 'America/Sao_Paulo';
const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dayYearFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const stampFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DAY_MS = 24 * 60 * 60 * 1000;
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

/** "Hoje", "Ontem" ou o dia por extenso, com o dia ao lado. */
function dayHeading(date: Date, now: Date) {
  const key = dayKey.format(date);
  const detail = dayFormat.format(date);
  if (key === dayKey.format(now)) return { title: 'Hoje', detail };
  if (key === dayKey.format(new Date(now.getTime() - DAY_MS)))
    return { title: 'Ontem', detail };
  const sameYear = key.slice(0, 4) === dayKey.format(now).slice(0, 4);
  return {
    title: capitalize(sameYear ? detail : dayYearFormat.format(date)),
    detail: null,
  };
}

/** Itens já do mais novo ao mais antigo, juntados por dia (no fuso da UERJ). */
function byDay<T>(items: readonly T[], dateOf: (item: T) => Date) {
  const groups: Array<{ key: string; date: Date; items: T[] }> = [];
  for (const item of items) {
    const date = dateOf(item);
    const key = dayKey.format(date);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, date, items: [item] });
  }
  return groups;
}

function icon(name: IconName, size = 20) {
  return html`<svg
    class="i"
    viewBox="${ICON_VIEWBOX}"
    width="${size}"
    height="${size}"
    aria-hidden="true"
    focusable="false"
  >
    <path d="${ICONS[name]}" />
  </svg>`;
}

const logo = html`<svg
  class="logo"
  viewBox="${AO_LOGO_VIEWBOX}"
  role="img"
  aria-label="AO UERJ"
>
  ${AO_LOGO_PATHS.map(d => html`<path d="${d}" />`)}
</svg>`;

const STYLE = trusted(`
:root{color-scheme:light dark;
--brand:#003468;--on-brand:#fff;--on-brand-muted:rgba(255,255,255,.78);--brand-rule:rgba(255,255,255,.16);--brand-press:rgba(255,255,255,.14);
--bg:#fff;--surface:#fff;--muted:#F6F7F9;--strong:#EDF0F4;--rule:#E4E7EC;--rule-strong:#D0D5DD;--field:#B8BFCA;
--ink:#101828;--ink-muted:#5D6679;--ink-subtle:#6B7487;
--accent:#004891;--fill:#004891;--fill-press:#02427F;--on-fill:#fff;--accent-soft:#E8F0FA;--accent-line:#BBD0EC;--selection:#CFE0F5;
--good:#17673A;--good-wash:#DDF5E3;--good-line:#A9DDB7;--bad:#A4261E;--bad-wash:#FCE4E2;--bad-line:#F1B5AF;
--lift:0 1px 2px rgba(0,12,32,.10),0 1px 1px rgba(0,12,32,.04)}
@media (prefers-color-scheme:dark){:root{
--brand:#071425;--on-brand:#E6EDF6;--on-brand-muted:#A7B4C6;--brand-rule:#2C4058;--brand-press:rgba(230,237,246,.12);
--bg:#0B1626;--surface:#111F33;--muted:#111F33;--strong:#182A43;--rule:#304259;--rule-strong:#3B4E68;--field:#63768F;
--ink:#E6EDF6;--ink-muted:#A7B4C6;--ink-subtle:#93A1B5;
--accent:#6DAEF0;--fill:#2A6BC0;--fill-press:#3273C9;--on-fill:#fff;--accent-soft:#123458;--accent-line:#2D5786;--selection:#17497B;
--good:#A4EBB8;--good-wash:#1E4A2E;--good-line:#3B6A4A;--bad:#FF9C92;--bad-wash:#612E2B;--bad-line:#854B47;
--lift:0 1px 2px rgba(0,6,18,.55)}}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--brand);scrollbar-color:var(--rule-strong) transparent;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;font:400 .9375rem/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--brand);caret-color:var(--accent);accent-color:var(--accent)}
::selection{background:var(--selection);color:var(--ink)}
a{color:var(--accent);text-underline-offset:3px;text-decoration-thickness:1px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.band :focus-visible{outline-color:var(--on-brand)}
.i{flex:none;fill:currentColor}
.band{color:var(--on-brand)}
.band-in,.tabs,.panel-in{max-width:66rem;margin:0 auto;padding-left:1.25rem;padding-right:1.25rem}
.band-in{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-top:1rem}
.brand{display:flex;align-items:center;gap:.75rem;color:inherit;text-decoration:none;min-height:3rem}
.logo{width:2.5rem;height:auto;fill:currentColor}
.brand b{font-size:1.0625rem;font-weight:600;letter-spacing:-.01em}
.band-act{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:0 .875rem;border:0;border-radius:10px;background:transparent;color:var(--on-brand-muted);font:inherit;font-weight:500;cursor:pointer}
.band-act:hover{background:var(--brand-press);color:var(--on-brand)}
.tabs{display:flex;gap:.25rem;padding-top:.5rem;overflow-x:auto;scrollbar-width:none}
.tabs a{position:relative;display:inline-flex;align-items:center;gap:.5rem;min-height:3rem;padding:0 .875rem;color:var(--on-brand-muted);text-decoration:none;font-weight:500;white-space:nowrap}
.tabs a:hover{color:var(--on-brand)}
.tabs a[aria-current]{color:var(--on-brand);font-weight:600}
.tabs a[aria-current]::after{content:"";position:absolute;left:.875rem;right:.875rem;bottom:0;height:3px;border-radius:3px 3px 0 0;background:var(--on-brand)}
.tabs .n{min-width:1.5rem;padding:0 .4375rem;border-radius:6px;background:var(--brand-rule);font-size:.8125rem;line-height:1.5rem;text-align:center;font-variant-numeric:tabular-nums}
.panel{flex:1;background:var(--bg);border-top-left-radius:48px}
.panel-in{padding-top:2.25rem;padding-bottom:4rem}
h1{margin:0;font-size:1.625rem;line-height:1.25;font-weight:600;letter-spacing:-.02em;text-wrap:balance}
.lede{margin:.375rem 0 0;color:var(--ink-muted)}
.lede b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1.25rem;margin-top:1.5rem}
.seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:var(--strong)}
.seg a{display:inline-flex;align-items:center;gap:.4375rem;min-height:2.5rem;padding:0 .875rem;border-radius:8px;color:var(--ink-muted);text-decoration:none;font-weight:500}
.seg a:hover{color:var(--ink)}
.seg a[aria-current]{background:var(--surface);color:var(--ink);box-shadow:var(--lift)}
.seg b,.chip b{font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink-subtle)}
.seg a[aria-current] b{color:var(--ink-muted)}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0 0;padding:0}
.chip{display:inline-flex;align-items:center;gap:.4375rem;min-height:2.25rem;padding:0 .75rem;border:1px solid var(--rule-strong);border-radius:8px;color:var(--ink);text-decoration:none;font-size:.875rem;font-weight:500;white-space:nowrap}
.chip:hover{background:var(--muted)}
.chip[aria-current]{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent)}
.chip[aria-current] b{color:var(--accent)}
.day{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .625rem;margin:2.5rem 0 .25rem;font-size:1rem;font-weight:600;letter-spacing:-.01em}
.day span{font-size:.875rem;font-weight:400;color:var(--ink-muted)}
.list{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;gap:.25rem 1rem;padding:1.125rem 0;border-bottom:1px solid var(--rule)}
.row:last-child{border-bottom:0}
.when{padding-top:.0625rem;color:var(--ink-muted);font-size:.875rem;font-variant-numeric:tabular-nums}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}
.tag{display:inline-flex;align-items:center;min-height:1.75rem;padding:0 .5rem;border-radius:6px;background:var(--accent-soft);color:var(--accent);font-size:.8125rem;font-weight:600;text-decoration:none;overflow-wrap:anywhere}
a.tag:hover{text-decoration:underline}
.state{display:inline-flex;align-items:center;gap:.3125rem;min-height:1.75rem;padding:0 .5rem;border-radius:6px;background:var(--good-wash);color:var(--good);font-size:.8125rem;font-weight:600}
.who{font-weight:600}
.desc{margin:.5rem 0 0;max-width:70ch;white-space:pre-wrap;overflow-wrap:anywhere}
.none{color:var(--ink-subtle)}
.row.done .desc{color:var(--ink-muted)}
.long summary{display:block;cursor:pointer;list-style:none}
.long summary::-webkit-details-marker{display:none}
.long summary .desc{display:inline}
.more{margin-left:.25rem;color:var(--accent);font-weight:600;white-space:nowrap}
.long summary:hover .more{text-decoration:underline;text-underline-offset:3px}
.long[open] .more{display:none}
.long .rest{margin-top:0}
.facts{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem;margin:.75rem 0 0;font-size:.8125rem}
.facts div{display:flex;gap:.4375rem}
.facts dt{color:var(--ink-muted)}
.facts dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.foot{display:flex;flex-wrap:wrap;gap:0 1.25rem;margin-top:.5rem;font-size:.875rem}
.link{display:inline-flex;align-items:center;gap:.375rem;min-height:2.25rem;text-decoration:none;overflow-wrap:anywhere}
.link:hover{text-decoration:underline}
.link .i{width:1.125rem;height:1.125rem}
.quiet{color:var(--ink-muted)}
.act{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.5rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.4375rem;min-height:2.5rem;padding:0 .875rem;border:1px solid transparent;border-radius:10px;background:var(--fill);color:var(--on-fill);font:inherit;font-size:.875rem;font-weight:600;white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--fill-press)}
.btn.tonal{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-line)}
.btn.tonal:hover{background:var(--fill);color:var(--on-fill);border-color:var(--fill)}
.btn.line{background:transparent;color:var(--ink);border-color:var(--rule-strong)}
.btn.line:hover{background:var(--muted)}
.btn .i{width:1.125rem;height:1.125rem}
.empty{display:flex;flex-direction:column;align-items:flex-start;gap:.5rem;margin-top:2.5rem;padding:1.5rem;border:1px solid var(--rule);border-radius:16px;border-top-right-radius:0}
.empty .i{width:2rem;height:2rem;color:var(--good)}
.empty p{margin:0;font-weight:600}
.note{margin-top:2rem;color:var(--ink-muted);font-size:.875rem}
.notice{margin:1rem 0 0;padding:.75rem .875rem;border:1px solid var(--bad-line);border-radius:10px;border-top-right-radius:0;background:var(--bad-wash);color:var(--ink)}
.login{max-width:26rem}
.login form{margin-top:1.5rem}
.login label{display:block;margin-bottom:.375rem;font-weight:600}
.login .field+label{margin-top:1rem}
.login select.field{appearance:auto}
.field{width:100%;min-height:3rem;padding:0 .875rem;border:1px solid var(--field);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;letter-spacing:.02em}
.field:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
.login .btn{width:100%;min-height:3rem;margin-top:1rem;font-size:.9375rem}
.back{display:inline-flex;align-items:center;gap:.375rem;margin-bottom:1rem;min-height:2.25rem}
.sheet{margin-top:1.5rem;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.5rem 1.5rem;max-width:40rem}
.sheet dt{color:var(--ink-muted)}
.sheet dd{margin:0;font-weight:600;overflow-wrap:anywhere}
.raw{margin:1.5rem 0 0;padding:1rem;max-width:48rem;overflow:auto;border:1px solid var(--rule);border-radius:10px;border-top-right-radius:0;background:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8125rem;line-height:1.6}
h2.sub{margin:2.5rem 0 .25rem;font-size:1.0625rem;font-weight:600;letter-spacing:-.01em}
.sub-lede{margin:0;color:var(--ink-muted);font-size:.875rem;max-width:70ch}
.scroll{margin-top:1rem;overflow-x:auto;border:1px solid var(--rule);border-radius:12px;border-top-right-radius:0}
.nums{width:100%;border-collapse:collapse;font-size:.875rem;font-variant-numeric:tabular-nums}
.nums th,.nums td{padding:.625rem .5rem;border-bottom:1px solid var(--rule);text-align:right;white-space:nowrap}
.nums th{color:var(--ink-muted);font-weight:500;font-size:.8125rem;background:var(--muted)}
.nums th:first-child,.nums td:first-child{text-align:left}
.nums tbody tr:last-child td{border-bottom:0}
.nums td b{font-weight:600}
.nums td span{margin-left:.375rem;color:var(--ink-subtle);font-size:.8125rem}
.hours{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0 0;padding:0;list-style:none}
.hours li{display:flex;align-items:baseline;gap:.375rem;min-height:2.25rem;padding:.375rem .75rem;border:1px solid var(--rule-strong);border-radius:8px;font-size:.875rem;font-variant-numeric:tabular-nums}
.hours b{font-weight:600}
.hours span{color:var(--ink-muted)}
.hours .bad{color:var(--bad)}
.source{display:inline-flex;align-items:center;min-height:1.75rem;padding:0 .5rem;border:1px solid var(--rule-strong);border-radius:6px;color:var(--ink-muted);font-size:.8125rem;font-weight:500}
.done-notice{margin:1.25rem 0 0;padding:.75rem .875rem;border:1px solid var(--good-line);border-radius:10px;border-top-right-radius:0;background:var(--good-wash);color:var(--ink)}
@keyframes found{from{background:var(--accent-soft)}to{background:transparent}}
.row:target{animation:found 1.6s cubic-bezier(.16,1,.3,1)}
@media (prefers-reduced-motion:reduce){.row:target{animation:none}}
@media (max-width:40rem){
.panel{border-top-left-radius:32px}
.panel-in{padding-top:1.75rem}
h1{font-size:1.375rem}
.brand b{font-size:1rem}
.band-act span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.chips{flex-wrap:nowrap;overflow-x:auto;margin-left:-1.25rem;margin-right:-1.25rem;padding:0 1.25rem .25rem;scrollbar-width:thin}
.row{grid-template-columns:minmax(0,1fr);gap:.25rem}
.when{padding:0}
.act{margin-top:.5rem}
.sheet{grid-template-columns:minmax(0,1fr);gap:0}
.sheet dd{margin-bottom:.625rem}
}
`);

type Tab = 'reports' | 'suggestions' | 'companion' | 'campus' | 'students';

/** As contagens das abas (`campus`: os avisos denunciados que esperam a moderação). */
type Counts = {
  open: number;
  suggestions: number;
  companion: number;
  campus: number;
};

/** O molde: cabeçalho azul com o logo, as abas e o painel. */
function layout({
  base,
  title,
  tab,
  csrf,
  counts,
  body,
}: {
  base: string;
  title: string;
  tab: Tab | null;
  csrf: string | null;
  counts?: Counts;
  body: Html;
}) {
  const tabLink = (id: Tab, href: string, label: string, n?: number) =>
    html`<a href="${href}" ${trusted(tab === id ? ' aria-current="page"' : '')}
      >${label}${n === undefined ? null : html`<span class="n">${n.toLocaleString('pt-BR')}</span>`}</a
    >`;
  return html`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#003468" />
        <link rel="icon" href="data:," />
        <title>${title} · AO UERJ</title>
        <style>
          ${STYLE}
        </style>
      </head>
      <body>
        <header class="band">
          <div class="band-in">
            <a class="brand" href="${base}/admin"
              >${logo}${csrf ? html`<b>Administração</b>` : null}</a
            >
            ${
              csrf
                ? html`<form method="post" action="${base}/admin/sair">
                    <input type="hidden" name="csrf" value="${csrf}" /><button
                      class="band-act"
                      type="submit"
                    >
                      ${icon('logout')}<span>Sair</span>
                    </button>
                  </form>`
                : null
            }
          </div>
          ${
            counts
              ? html`<nav class="tabs" aria-label="Seções">
                  ${tabLink('reports', `${base}/admin`, 'Relatos', counts.open)}${tabLink('suggestions', `${base}/admin/sugestoes`, 'Sugestões', counts.suggestions)}${tabLink('companion', `${base}/admin/companhia`, 'Companhia', counts.companion)}${tabLink('campus', `${base}/admin/agora`, 'Agora no campus', counts.campus)}${tabLink('students', `${base}/admin/alunos`, 'Alunos')}
                </nav>`
              : html`<div class="tabs" aria-hidden="true"></div>`
          }
        </header>
        <main class="panel"><div class="panel-in">${body}</div></main>
      </body>
    </html> `;
}

/* ------------------------------------------------------------------ login */

/**
 * A única página que qualquer um vê: não diz o que há atrás dela, onde fica o
 * token nem como ele é feito.
 */
export function loginPage({
  base,
  notice,
}: {
  base: string;
  notice: 'failed' | 'limited' | null;
}) {
  const messages = {
    failed: 'Token inválido.',
    limited: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  };
  return layout({
    base,
    title: 'Acesso restrito',
    tab: null,
    csrf: null,
    body: html`<section class="login">
      <h1>Acesso restrito</h1>
      ${notice ? html`<p class="notice" role="alert">${messages[notice]}</p>` : null}
      <form method="post" action="${base}/admin/entrar">
        <label for="token">Token</label>
        <input
          class="field"
          id="token"
          name="token"
          type="password"
          autocomplete="current-password"
          required
          autofocus
          spellcheck="false"
        />
        <button class="btn" type="submit">Entrar</button>
      </form>
    </section>`,
  });
}

/* ---------------------------------------------------------------- relatos */

const STATUS_PARAM: Record<ReviewStatus, string> = {
  open: 'abertos',
  resolved: 'resolvidos',
  all: 'todos',
};

/** O recorte vindo da URL (`?situacao=&tela=`); o resto vira o padrão. */
export function filterFromQuery(query: Record<string, unknown>): ReviewFilter {
  const status =
    (Object.keys(STATUS_PARAM) as ReviewStatus[]).find(
      key => STATUS_PARAM[key] === query.situacao,
    ) ?? 'open';
  const page =
    typeof query.tela === 'string' && query.tela ? query.tela : undefined;
  return page === undefined ? { status } : { status, page };
}

/** A URL de um recorte, sem os padrões. */
export function reviewUrl(
  base: string,
  { status, page }: ReviewFilter,
  hash = '',
) {
  const query = new URLSearchParams();
  if (status !== 'open') query.set('situacao', STATUS_PARAM[status]);
  if (page !== undefined) query.set('tela', page);
  const search = query.toString();
  return `${base}/admin${search ? `?${search}` : ''}${hash}`;
}

/** A descrição; uma longa mostra o começo e abre o resto num toque. */
function description(text: string | undefined) {
  if (!text) return html`<p class="desc none">Sem descrição.</p>`;
  const PREVIEW = 480;
  if (text.length <= PREVIEW + 120) return html`<p class="desc">${text}</p>`;
  const space = text.lastIndexOf(' ', PREVIEW);
  const at = space > PREVIEW * 0.6 ? space : PREVIEW;
  return html`<details class="long">
    <summary>
      <span class="desc">${text.slice(0, at)}</span
      ><span class="more">… ler tudo</span>
    </summary>
    <p class="desc rest">${text.slice(at).trimStart()}</p>
  </details>`;
}

const kib = (bytes: number) =>
  `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pt-BR')} KB`;

function diagnosticFacts(diagnostic: Diagnostic) {
  const facts: Array<[string, string]> = [
    ['App', diagnostic.appVersion],
    ['Leitura do portal', diagnostic.parserVersion],
    ['Tipo', diagnostic.category],
  ];
  if (diagnostic.subjectCode)
    facts.push(['Disciplina', diagnostic.subjectCode]);
  if (diagnostic.eventId) facts.push(['Sentry', diagnostic.eventId]);
  return html`<dl class="facts">
    ${facts.map(
      ([term, value]) =>
        html`<div>
          <dt>${term}</dt>
          <dd>${value}</dd>
        </div>`,
    )}
  </dl>`;
}

function attachmentLinks(base: string, report: ReviewedReport) {
  const links = report.attachments.map((attachment: AttachmentView, index) => {
    const href = `${base}/admin/relatos/${encodeURIComponent(report.id)}/anexos/${encodeURIComponent(attachment.id)}`;
    const number = report.attachments.length > 1 ? ` ${index + 1}` : '';
    if (attachment.kind === 'missing')
      return html`<span class="link quiet"
        >Anexo${number} não encontrado</span
      >`;
    const label =
      attachment.kind === 'diagnostic'
        ? `Diagnóstico${number}`
        : `Página do portal${number} · ${kib(attachment.bytes)}`;
    return html`<a
      class="link"
      href="${href}"
      target="_blank"
      rel="noopener noreferrer"
      >${icon('open_in_new')}${label}</a
    >`;
  });
  return links;
}

function reportRow({
  base,
  report,
  filter,
  csrf,
  people,
}: {
  base: string;
  report: ReviewedReport;
  filter: ReviewFilter;
  csrf: string;
  people: ReadonlyMap<string, Student>;
}) {
  const student = report.studentId ? people.get(report.studentId) : undefined;
  const done = report.resolvedAt !== null;
  const diagnostics = report.attachments.flatMap(attachment =>
    attachment.kind === 'diagnostic' ? [attachment.diagnostic] : [],
  );
  const action = done ? 'reabrir' : 'resolver';
  return html`<li class="row${done ? ' done' : ''}" id="relato-${report.id}">
    <time class="when" datetime="${report.createdAt.toISOString()}"
      >${hourFormat.format(report.createdAt)}</time
    >
    <div>
      <div class="top">
        <a
          class="tag"
          href="${reviewUrl(base, { status: filter.status, page: report.page })}"
          title="Só os relatos desta tela"
          >${report.page}</a
        >${
          done
            ? html`<span class="state"
                >${icon('check_circle', 16)}Resolvido em
                ${stampFormat.format(report.resolvedAt!)}</span
              >`
            : null
        }
      </div>
      ${description(report.description)} ${diagnostics.map(diagnosticFacts)}
      <div class="foot">
        ${
          report.email
            ? html`<a class="link" href="mailto:${report.email}"
                >${icon('mail')}${report.email}</a
              >`
            : html`<span class="link quiet">Sem e-mail para resposta</span>`
        }${student ? studentLink(base, student) : null}${attachmentLinks(base, report)}
      </div>
    </div>
    <form
      class="act"
      method="post"
      action="${base}/admin/relatos/${encodeURIComponent(report.id)}/${action}"
    >
      <input type="hidden" name="csrf" value="${csrf}" />
      <input
        type="hidden"
        name="situacao"
        value="${STATUS_PARAM[filter.status]}"
      />
      ${filter.page === undefined ? null : html`<input type="hidden" name="tela" value="${filter.page}" />`}
      ${
        done
          ? html`<button class="btn line" type="submit">
              ${icon('restart_alt')}Reabrir
            </button>`
          : html`<button class="btn tonal" type="submit">
              ${icon('check_circle')}Resolver
            </button>`
      }
    </form>
  </li>`;
}

export function reportsPage({
  base,
  review,
  filter,
  csrf,
  now,
  suggestions,
  companionReports,
  campusFlags,
  people = new Map(),
}: {
  base: string;
  review: Review;
  filter: ReviewFilter;
  csrf: string;
  now: Date;
  suggestions: number;
  /** Os alunos dos relatos da v2, abertos. */
  people?: ReadonlyMap<string, Student>;
  /** As denúncias da Companhia agora guardadas (30 dias). */
  companionReports: number;
  /** Os avisos de Agora no campus denunciados que esperam a moderação. */
  campusFlags: number;
}) {
  const { summary } = review;
  const totals: Record<ReviewStatus, number> = {
    open: summary.open,
    resolved: summary.resolved,
    all: summary.open + summary.resolved,
  };
  const pagesWithOpen = summary.pages.filter(page => page.open > 0).length;
  const statusLink = (status: ReviewStatus, label: string) =>
    html`<a
      href="${reviewUrl(base, { status, page: filter.page })}"
      ${trusted(filter.status === status ? ' aria-current="page"' : '')}
      >${label}<b>${totals[status].toLocaleString('pt-BR')}</b></a
    >`;
  // as telas com relatos no recorte da situação
  const inStatus = (page: { open: number; resolved: number }) =>
    filter.status === 'open'
      ? page.open
      : filter.status === 'resolved'
        ? page.resolved
        : page.open + page.resolved;
  const pages = summary.pages.filter(page => inStatus(page) > 0);
  const chip = (page: string | undefined, label: string, n: number) =>
    html`<a
      class="chip"
      href="${reviewUrl(base, { status: filter.status, page })}"
      ${trusted(filter.page === page ? ' aria-current="page"' : '')}
      >${label}<b>${n.toLocaleString('pt-BR')}</b></a
    >`;

  const groups = byDay(review.reports, report => report.createdAt);
  const emptyText =
    filter.status === 'open'
      ? `Nenhum relato aberto${filter.page ? ' nesta tela' : ''}.`
      : `Nenhum relato${filter.status === 'resolved' ? ' resolvido' : ''}${filter.page ? ' nesta tela' : ''}.`;

  return layout({
    base,
    title: 'Relatos de erro',
    tab: 'reports',
    csrf,
    counts: {
      open: summary.open,
      suggestions,
      companion: companionReports,
      campus: campusFlags,
    },
    body: html`<h1>Relatos de erro</h1>
      <p class="lede">
        <b>${count(summary.open, 'aberto', 'abertos')}</b>${
          pagesWithOpen ? ` em ${count(pagesWithOpen, 'tela', 'telas')}` : ''
        }
        · ${count(summary.resolved, 'resolvido', 'resolvidos')}
      </p>
      <div class="filters">
        <nav class="seg" aria-label="Situação">
          ${statusLink('open', 'Abertos')}${statusLink('resolved', 'Resolvidos')}${statusLink('all', 'Todos')}
        </nav>
      </div>
      ${
        pages.length > 1 || filter.page !== undefined
          ? html`<nav class="chips" aria-label="Telas">
              ${chip(undefined, 'Todas as telas', totals[filter.status])}${pages.map(page => chip(page.page, page.page, inStatus(page)))}
            </nav>`
          : null
      }
      ${
        groups.length
          ? groups.map(group => {
              const heading = dayHeading(group.date, now);
              return html`<section aria-labelledby="dia-${group.key}">
                <h2 class="day" id="dia-${group.key}">
                  ${heading.title}${heading.detail ? html`<span>${heading.detail}</span>` : null}
                </h2>
                <ol class="list">
                  ${group.items.map(report => reportRow({ base, report, filter, csrf, people }))}
                </ol>
              </section>`;
            })
          : html`<div class="empty">
              ${icon('task_alt')}
              <p>${emptyText}</p>
              ${
                filter.status === 'all'
                  ? null
                  : html`<a
                      class="link"
                      href="${reviewUrl(base, { status: 'all', page: filter.page })}"
                      >Ver todos os relatos</a
                    >`
              }
            </div>`
      }
      ${
        review.total > review.reports.length
          ? html`<p class="note">
              Mostrando os ${review.reports.length.toLocaleString('pt-BR')} mais
              recentes de ${review.total.toLocaleString('pt-BR')}. Filtre por
              tela para ver os outros.
            </p>`
          : null
      }`,
  });
}

/* -------------------------------------------------------------- sugestões */

export function suggestionsPage({
  base,
  suggestions,
  csrf,
  now,
  openReports,
  companionReports,
  campusFlags,
}: {
  base: string;
  suggestions: Suggestion[];
  csrf: string;
  now: Date;
  openReports: number;
  companionReports: number;
  campusFlags: number;
}) {
  const groups = byDay(suggestions, suggestion => suggestion.createdAt);
  return layout({
    base,
    title: 'Sugestões',
    tab: 'suggestions',
    csrf,
    counts: {
      open: openReports,
      suggestions: suggestions.length,
      companion: companionReports,
      campus: campusFlags,
    },
    body: html`<h1>Sugestões</h1>
      <p class="lede">
        ${count(suggestions.length, 'sugestão', 'sugestões')} dos apps, das mais
        novas às mais antigas.
      </p>
      ${
        groups.length
          ? groups.map(group => {
              const heading = dayHeading(group.date, now);
              return html`<section aria-labelledby="dia-${group.key}">
                <h2 class="day" id="dia-${group.key}">
                  ${heading.title}${heading.detail ? html`<span>${heading.detail}</span>` : null}
                </h2>
                <ol class="list">
                  ${group.items.map(
                    suggestion =>
                      html`<li class="row">
                        <time
                          class="when"
                          datetime="${suggestion.createdAt.toISOString()}"
                          >${hourFormat.format(suggestion.createdAt)}</time
                        >
                        <div>
                          <div class="top">
                            <span class="who">${suggestion.name}</span>
                          </div>
                          <p class="desc">${suggestion.content}</p>
                          <div class="foot">
                            ${
                              suggestion.email
                                ? html`<a
                                    class="link"
                                    href="mailto:${suggestion.email}"
                                    >${icon('mail')}${suggestion.email}</a
                                  >`
                                : html`<span class="link quiet"
                                    >Sem e-mail para resposta</span
                                  >`
                            }
                          </div>
                        </div>
                        <span></span>
                      </li>`,
                  )}
                </ol>
              </section>`;
            })
          : html`<div class="empty">
              ${icon('lightbulb')}
              <p>Nenhuma sugestão por enquanto.</p>
            </div>`
      }`,
  });
}

/* ------------------------------------------- denúncias da Companhia agora */

const REASON_LABEL: Record<CallReport['reason'], string> = {
  harassment: 'Assédio ou ofensa',
  strange: 'Comportamento estranho',
  spam: 'Spam ou propaganda',
  other: 'Outro motivo',
};
const SPOT_LABEL: Record<CallReport['spot'], string> = {
  ru: 'RU',
  lago: 'Lago dos Peixinhos',
  concha: 'Concha Acústica',
  'portao-1': 'Portão 1',
  'portao-5': 'Portão 5',
};
const DESTINATION_LABEL: Record<
  NonNullable<CallReport['destination']>,
  string
> = { metro: 'metrô', trem: 'trem', onibus: 'ponto de ônibus' };

/** "Mesa no RU, 12:15" ou "Grupo para o metrô, 22:15" (as palavras do app). */
function callTitle(report: CallReport) {
  const time = hourFormat.format(report.at);
  return report.kind === 'home' && report.destination
    ? `Grupo para o ${DESTINATION_LABEL[report.destination]}, ${time}`
    : `Mesa no ${SPOT_LABEL[report.spot]}, ${time}`;
}

const SOURCE_LABEL: Record<NonNullable<CallReport['source']>, string> = {
  member: 'De quem foi junto',
  host: 'De quem abriu',
  outsider: 'De fora',
};

/** Quantos dias de números a página mostra. */
export const COMPANION_STATS_DAYS = 14;

const statDayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

type StatCounts = DayStats['counts'];
const n = (counts: StatCounts, key: keyof StatCounts) => counts[key] ?? 0;
const sumOf = (counts: StatCounts, prefix: string) =>
  Object.entries(counts)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((total, [, value]) => total + (value ?? 0), 0);
const percent = (part: number, total: number) =>
  total ? `${Math.round((part * 100) / total)}%` : '';

/** "seg., 23/11" a partir de "2026-11-23", no meio do dia de São Paulo. */
const statDay = (day: string) =>
  statDayFormat.format(new Date(`${day}T12:00:00-03:00`));

/** Um número e, ao lado, quanto ele é do total. */
const cell = (value: number, total?: number) =>
  html`<td>
    <b>${value.toLocaleString('pt-BR')}</b
    >${total !== undefined && percent(value, total) ? html`<span>${percent(value, total)}</span>` : null}
  </td>`;

/** Os números de cada dia: quem olhou, se havia o que achar e se deu certo. */
function statsSection(stats: DayStats[]) {
  if (!stats.length)
    return html`<div class="empty">
      ${icon('task_alt')}
      <p>Ainda não há números: eles começam no primeiro uso.</p>
    </div>`;
  const busy = stats.reduce((total, day) => total + n(day.counts, 'busy'), 0);
  const latest = stats[0];
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    lookers: n(latest.counts, `lookers_h${hour}`),
    empty: n(latest.counts, `empty_h${hour}`),
  })).filter(item => item.lookers > 0);
  return html`<div class="scroll">
      <table class="nums">
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Olharam</th>
            <th scope="col">Vazia</th>
            <th scope="col">Mesas</th>
            <th scope="col">Grupos</th>
            <th scope="col">Companhia</th>
            <th scope="col">No ponto</th>
            <th scope="col">Em casa</th>
            <th scope="col">Tirados</th>
            <th scope="col">Denúncias</th>
            <th scope="col">Fora do ar</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(({ day, counts }) => {
            const lookers = sumOf(counts, 'lookers_h');
            const opened = n(counts, 'opened_lunch') + n(counts, 'opened_home');
            const filled = n(counts, 'filled_lunch') + n(counts, 'filled_home');
            const arrived =
              n(counts, 'arrived_lunch') + n(counts, 'arrived_home');
            const reports =
              n(counts, 'reports_member') +
              n(counts, 'reports_host') +
              n(counts, 'reports_outsider');
            return html`<tr>
              <td>${statDay(day)}</td>
              ${cell(lookers)}${cell(sumOf(counts, 'empty_h'), lookers)}
              ${cell(n(counts, 'opened_lunch'))}${cell(n(counts, 'opened_home'))}
              ${cell(filled, opened)}${cell(arrived, filled)}
              ${cell(n(counts, 'phrase_home_safe'))}${cell(n(counts, 'removed'))}
              <td>
                <b>${reports.toLocaleString('pt-BR')}</b
                ><span
                  >(${n(counts, 'reports_outsider').toLocaleString('pt-BR')})</span
                >
              </td>
              ${cell(n(counts, 'hidden_reports') + n(counts, 'hidden_moderation'))}
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
    ${
      hours.length
        ? html`<h2 class="sub">Por hora, ${statDay(latest.day)}</h2>
            <p class="sub-lede">
              Quem chegou à lista em cada hora e quanto dela estava vazia: as
              horas em que muita gente olha e nada acha são as que pedem um
              convite.
            </p>
            <ul class="hours">
              ${hours.map(
                item =>
                  html`<li>
                    <b>${item.hour}h</b>
                    <span>${count(item.lookers, 'olhou', 'olharam')}</span>
                    ${item.empty ? html`<span class="bad">${percent(item.empty, item.lookers)} vazia</span>` : null}
                  </li>`,
              )}
            </ul>`
        : null
    }
    ${
      busy
        ? html`<p class="notice">
            O teto do campus recusou ${count(busy, 'abertura', 'aberturas')}
            nestes dias.
          </p>`
        : null
    }`;
}

export function companionPage({
  base,
  reports,
  stats,
  csrf,
  now,
  openReports,
  suggestions,
  campusFlags,
  done,
  people = new Map(),
}: {
  base: string;
  reports: CallReport[];
  stats: DayStats[];
  csrf: string;
  now: Date;
  openReports: number;
  suggestions: number;
  campusFlags: number;
  /** O resultado do "Tirar do ar" que acabou de voltar para cá. */
  done: 'hidden' | 'gone' | null;
  /** Os alunos que aparecem nas denúncias, abertos. */
  people?: ReadonlyMap<string, Student>;
}) {
  const groups = byDay(reports, report => report.createdAt);
  // o botão vai só na denúncia mais nova de cada chamada que ainda vale
  const offered = new Set<string>();
  const canHide = (report: CallReport) => {
    if (offered.has(report.callId)) return false;
    offered.add(report.callId);
    return (
      !report.hidden &&
      report.callExpiresAt !== null &&
      report.callExpiresAt > now
    );
  };
  return layout({
    base,
    title: 'Companhia agora',
    tab: 'companion',
    csrf,
    counts: {
      open: openReports,
      suggestions,
      companion: reports.length,
      campus: campusFlags,
    },
    body: html`<h1>Companhia agora</h1>
      <p class="lede">
        Os números de cada dia, só contagens (sem quem, sem recado nem hora
        exata), e as denúncias dos últimos 30 dias.
      </p>
      ${
        done === 'hidden'
          ? html`<p class="done-notice">
              Saiu do ar: some da lista, e quem estava dentro vê que não existe
              mais.
            </p>`
          : done === 'gone'
            ? html`<p class="notice">Já tinha acabado ou saído do ar.</p>`
            : null
      }
      <h2 class="sub">Últimos ${COMPANION_STATS_DAYS} dias</h2>
      <p class="sub-lede">
        "Olharam": alunos que chegaram à lista (uma vez a cada 15 minutos);
        "Vazia": desses, os que não acharam nenhuma mesa ou grupo. "Mesas" e
        "Grupos": os abertos (o grupo é o de voltar junto). "Companhia": os que
        chegaram a duas pessoas, sobre os abertos. "No ponto": deles, os que
        tiveram um "Cheguei no ponto". "Em casa": os "Cheguei em casa" dos
        grupos. Denúncias: o total e, entre parênteses, as de fora.
      </p>
      ${statsSection(stats)}

      <h2 class="sub">Denúncias</h2>
      <p class="sub-lede">
        ${count(reports.length, 'denúncia', 'denúncias')}, das mais novas às
        mais antigas, com o que a mesa ou o grupo era quando foi denunciado (sem
        as chaves de quem estava dentro). Assédio denunciado por quem foi junto
        tira do ar na hora; outro motivo, com ${MEMBER_REPORTS_TO_HIDE} pessoas
        de dentro. A denúncia de fora não tira nada sozinha: quem decide é você,
        aqui, enquanto a mesa ou o grupo valer.
      </p>
      ${
        groups.length
          ? groups.map(group => {
              const heading = dayHeading(group.date, now);
              return html`<section aria-labelledby="dia-${group.key}">
                <h2 class="day" id="dia-${group.key}">
                  ${heading.title}${heading.detail ? html`<span>${heading.detail}</span>` : null}
                </h2>
                <ol class="list">
                  ${group.items.map(
                    report =>
                      html`<li class="row" id="denuncia-${report.id}">
                        <time
                          class="when"
                          datetime="${report.createdAt.toISOString()}"
                          >${hourFormat.format(report.createdAt)}</time
                        >
                        <div>
                          <div class="top">
                            <span class="tag"
                              >${REASON_LABEL[report.reason]}</span
                            >
                            ${report.source ? html`<span class="source">${SOURCE_LABEL[report.source]}</span>` : null}
                            <span class="who">${callTitle(report)}</span>
                          </div>
                          ${
                            report.note
                              ? html`<p class="desc">"${report.note}"</p>`
                              : null
                          }
                          ${peopleList(base, report, people)}
                          <div class="foot">
                            <span>${report.names.join(', ') || 'Ninguém'}</span>
                            <span class="quiet"
                              >${count(report.count, 'denúncia', 'denúncias')}
                              aqui${report.hidden ? ' · saiu do ar' : ''}</span
                            >
                          </div>
                        </div>
                        ${
                          canHide(report)
                            ? html`<form
                                class="act"
                                method="post"
                                action="${base}/admin/companhia/${encodeURIComponent(report.callId)}/tirar"
                              >
                                <input
                                  type="hidden"
                                  name="csrf"
                                  value="${csrf}"
                                />
                                <button class="btn tonal" type="submit">
                                  ${icon('visibility_off')}Tirar do ar
                                </button>
                              </form>`
                            : html`<span></span>`
                        }
                      </li>`,
                  )}
                </ol>
              </section>`;
            })
          : html`<div class="empty">
              ${icon('task_alt')}
              <p>Nenhuma denúncia nos últimos 30 dias.</p>
            </div>`
      }`,
  });
}

/* -------------------------------------------------------- Agora no campus */

/** O aviso nas palavras do app ("Fila grande no bandejão"). */
const NOTICE_TITLE: Record<
  NoticeKind,
  Partial<Record<NoticeStatus, string>>
> = {
  elevators: {
    short_queue: 'Elevadores: fila pequena',
    long_queue: 'Elevadores: fila de 10 min ou mais',
    stopped: 'Elevadores: todos parados',
  },
  ru: {
    short_queue: 'Fila pequena no bandejão',
    long_queue: 'Fila grande no bandejão',
    closed: 'Bandejão fechado',
  },
  power: {
    no_power: 'Sem luz',
    no_ac: 'Sem ar-condicionado',
    no_outlets: 'Tomadas sem energia',
  },
  internet: { wifi_down: 'Wi-Fi fora', wifi_slow: 'Wi-Fi lento' },
  restroom: {
    no_water: 'Banheiro sem água',
    closed: 'Banheiro interditado',
    no_paper: 'Banheiro sem papel',
  },
  access: {
    gate_closed: 'Portão fechado',
    ramp_closed: 'Rampa interditada',
    room_locked: 'Sala trancada',
  },
};

/** Os portões como o Mapa do app os chama. */
const GATE_LABEL: Record<Gate, string> = {
  'portao-metro': 'Portão 1',
  'portao-leste': 'Portão 3',
  'portao-sudeste': 'Portão 4',
  'portao-sfx': 'Portão 5',
  'portao-oeste': 'Portão 6',
  'portao-radial': 'Portão 7',
};

const floorText = (floor: string) =>
  floor === 'T' ? 'térreo' : floor === 'SE' ? 'subsolo' : `${floor}º andar`;

function placeText(place: Place) {
  switch (place.type) {
    case 'elevators':
      return 'Hall dos elevadores, bloco C';
    case 'ru':
      return 'Bandejão (Restaurante Universitário)';
    case 'gate':
      return GATE_LABEL[place.gate];
    case 'floor':
      return `Bloco ${place.block}, ${floorText(place.floor)}`;
    case 'room':
      return `Sala ${place.room}, bloco ${place.block}`;
  }
}

const REMOVED_LABEL: Record<NonNullable<Notice['removedBy']>, string> = {
  flags: 'Fora do ar pelas denúncias',
  moderation: 'Tirado do ar por você',
  ban: 'Fora do ar: quem avisou foi banido',
};

function noticeStateTag(notice: Notice, now: Date) {
  if (notice.removedAt && notice.removedBy)
    return html`<span class="source"
      >${icon('visibility_off', 16)}${REMOVED_LABEL[notice.removedBy]}</span
    >`;
  if (notice.endedAt)
    return html`<span class="source"
      >${
        notice.endedBy === 'replaced'
          ? 'Trocado por outro aviso'
          : notice.endedBy === 'reporter'
            ? 'Quem avisou disse que acabou'
            : 'Acabou'
      }</span
    >`;
  if (notice.expiresAt <= now) return html`<span class="source">Venceu</span>`;
  return html`<span class="state">Valendo</span>`;
}

/** Um aviso para a moderação: o que é, onde, os números e quem avisou. */
function noticeRow({
  base,
  csrf,
  notice,
  now,
  people,
}: {
  base: string;
  csrf: string;
  notice: Notice;
  now: Date;
  people: ReadonlyMap<string, Student>;
}) {
  const reporter = people.get(notice.reporter);
  const action = (path: 'tirar' | 'voltar', label: string, tonal: boolean) =>
    html`<form
      method="post"
      action="${base}/admin/agora/${encodeURIComponent(notice.id)}/${path}"
    >
      <input type="hidden" name="csrf" value="${csrf}" />
      <button class="btn ${tonal ? 'tonal' : 'line'}" type="submit">
        ${icon(path === 'tirar' ? 'visibility_off' : 'visibility')}${label}
      </button>
    </form>`;
  const pending = notice.flags > 0 && !notice.reviewedAt;
  let actions: Html | null = null;
  if (notice.removedAt && notice.removedBy !== 'ban')
    actions = html`${action('voltar', 'Voltar ao ar', false)}${pending ? action('tirar', 'Manter fora', true) : null}`;
  else if (!notice.removedAt)
    actions = html`${action('tirar', 'Tirar do ar', true)}${pending ? action('voltar', 'Está certo', false) : null}`;
  return html`<li class="row" id="aviso-${notice.id}">
    <time class="when" datetime="${notice.createdAt.toISOString()}"
      >${hourFormat.format(notice.createdAt)}</time
    >
    <div>
      <div class="top">
        ${
          notice.flags
            ? html`<span class="tag"
                >${count(notice.flags, 'denúncia', 'denúncias')}</span
              >`
            : null
        }
        <span class="who"
          >${NOTICE_TITLE[notice.kind][notice.status] ?? notice.status}</span
        >
        ${noticeStateTag(notice, now)}
        ${
          notice.confirmations || notice.trusted
            ? null
            : html`<span class="source">Novo, sem confirmação</span>`
        }
      </div>
      <dl class="facts">
        <div>
          <dt>Lugar</dt>
          <dd>${placeText(notice.place)}</dd>
        </div>
        <div>
          <dt>Continua</dt>
          <dd>${notice.confirmations.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Acabou</dt>
          <dd>${notice.ends.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Viram</dt>
          <dd>${notice.views.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Valeus</dt>
          <dd>${notice.thanks.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Avisou</dt>
          <dd>
            ${
              reporter
                ? studentLink(base, reporter)
                : html`<span class="quiet">aluno não encontrado</span>`
            }
            ${
              notice.trusted
                ? html`<span class="quiet"> · nível ${notice.level}</span>`
                : null
            }
          </dd>
        </div>
      </dl>
      <div class="foot">
        <span class="quiet"
          >${
            notice.removedAt || notice.endedAt
              ? `Saiu às ${hourFormat.format(notice.removedAt ?? notice.endedAt!)}`
              : `Some às ${hourFormat.format(notice.expiresAt)}`
          }</span
        >
        ${
          notice.reviewedAt
            ? html`<span class="quiet">Você já olhou</span>`
            : null
        }
      </div>
    </div>
    <div class="act">${actions ?? html`<span></span>`}</div>
  </li>`;
}

/** Os números da semana do campus, numa tabela só. */
function campusWeekTable(moderation: Moderation) {
  const { week } = moderation;
  return html`<div class="scroll">
    <table class="nums">
      <thead>
        <tr>
          <th scope="col">Desde</th>
          <th scope="col">Avisos</th>
          <th scope="col">Respostas</th>
          <th scope="col">Viram</th>
          <th scope="col">Até acabar</th>
          <th scope="col">Valendo agora</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${statDay(week.from)}</td>
          ${cell(week.notices)}${cell(week.answers)}${cell(week.views)}
          <td>
            <b
              >${
                week.minutesToEnd === null
                  ? '–'
                  : `${week.minutesToEnd.toLocaleString('pt-BR')} min`
              }</b
            >
          </td>
          ${cell(moderation.active)}
        </tr>
      </tbody>
    </table>
  </div>`;
}

/**
 * Agora no campus para a moderação: os avisos denunciados primeiro (7
 * dias), depois os mais recentes, com quem avisou. Não há texto livre: o que
 * se modera é o aviso falso. Tirar do ar tira os pontos de quem avisou;
 * voltar ao ar devolve, e as denúncias não o tiram mais sozinhas.
 */
export function campusPage({
  base,
  csrf,
  now,
  counts,
  moderation,
  people,
  done,
}: {
  base: string;
  csrf: string;
  now: Date;
  counts: Counts;
  moderation: Moderation;
  /** Quem avisou, aberto. */
  people: ReadonlyMap<string, Student>;
  /** O resultado da ação que acabou de voltar para cá. */
  done: 'removed' | 'restored' | 'gone' | null;
}) {
  const row = (notice: Notice) =>
    noticeRow({ base, csrf, notice, now, people });
  return layout({
    base,
    title: 'Agora no campus',
    tab: 'campus',
    csrf,
    counts,
    body: html`<h1>Agora no campus</h1>
      <p class="lede">
        Os avisos dos alunos sobre o campus (elevadores, bandejão, luz,
        internet, banheiros, acesso). Os outros alunos não veem quem avisou;
        aqui, sim.
      </p>
      ${
        done === 'removed'
          ? html`<p class="done-notice">
              Saiu do ar, e quem avisou perdeu os pontos desse aviso.
            </p>`
          : done === 'restored'
            ? html`<p class="done-notice">
                Ficou no ar: as denúncias não o tiram mais sozinhas, e quem
                avisou recebeu os pontos de volta.
              </p>`
            : done === 'gone'
              ? html`<p class="notice">
                  Esse aviso não existe mais (ou saiu porque quem avisou foi
                  banido).
                </p>`
              : null
      }
      <h2 class="sub">Esta semana</h2>
      <p class="sub-lede">
        De segunda até agora. "Respostas": os "Continua" e "Acabou". "Até
        acabar": a média, em minutos, dos que os alunos encerraram.
      </p>
      ${campusWeekTable(moderation)}

      <h2 class="sub">Denunciados</h2>
      <p class="sub-lede">
        Os avisos com "Não é verdade" dos últimos 7 dias. Com
        ${count(FLAGS_TO_REMOVE, 'denúncia', 'denúncias')} de alunos diferentes,
        o aviso sai do ar sozinho.
      </p>
      ${
        moderation.flagged.length
          ? html`<ol class="list">
              ${moderation.flagged.map(row)}
            </ol>`
          : html`<div class="empty">
              ${icon('task_alt')}
              <p>Nenhum aviso denunciado nos últimos 7 dias.</p>
            </div>`
      }

      <h2 class="sub">Recentes</h2>
      ${
        moderation.recent.length
          ? html`<ol class="list">
              ${moderation.recent.map(row)}
            </ol>`
          : html`<p class="sub-lede">Ninguém avisou nada ainda.</p>`
      }`,
  });
}

/* ------------------------------------------------------------ diagnóstico */

export function diagnosticPage({
  base,
  report,
  diagnostic,
  raw,
  csrf,
}: {
  base: string;
  report: ErrorReport;
  diagnostic: Diagnostic;
  raw: string;
  csrf: string;
}) {
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // já veio validado; se não, fica como chegou
  }
  const rows: Array<[string, string]> = [
    ['Tela', report.page],
    ['Enviado em', stampFormat.format(report.createdAt)],
    ['Versão do app', diagnostic.appVersion],
    ['Leitura do portal', diagnostic.parserVersion],
    ['Tipo', diagnostic.category],
    ['Operação', diagnostic.operation],
  ];
  if (diagnostic.subjectCode) rows.push(['Disciplina', diagnostic.subjectCode]);
  if (diagnostic.eventId) rows.push(['Evento no Sentry', diagnostic.eventId]);
  return layout({
    base,
    title: 'Diagnóstico',
    tab: null,
    csrf,
    body: html`<a class="link back" href="${base}/admin#relato-${report.id}"
        >Voltar aos relatos</a
      >
      <h1>Diagnóstico do relato</h1>
      <p class="lede">O que o app mandou junto, sem dado pessoal.</p>
      <dl class="sheet">
        ${rows.map(
          ([term, value]) =>
            html`<dt>${term}</dt>
              <dd>${value}</dd>`,
        )}
      </dl>
      <pre class="raw">${pretty}</pre>`,
  });
}

/* --------------------------------------------------------------- avisos */

export function messagePage({
  base,
  title,
  text,
  csrf,
}: {
  base: string;
  title: string;
  text: string;
  csrf: string | null;
}) {
  return layout({
    base,
    title,
    tab: null,
    csrf,
    body: html`<h1>${title}</h1>
      <p class="lede">${text}</p>
      <p><a class="link" href="${base}/admin">Voltar aos relatos</a></p>`,
  });
}

/* ----------------------------------------------------------------- alunos */

const BAN_LABEL: Record<string, string> = {
  '1': '1 dia',
  '7': '7 dias',
  '30': '30 dias',
  sempre: 'Para sempre',
};

/** O aluno numa linha: o nome, a matrícula e o link para a página dele. */
function studentLink(base: string, student: Student) {
  return html`<a
    class="link"
    href="${base}/admin/alunos/${encodeURIComponent(student.id)}"
    >${icon('person')}${student.name} · ${student.matricula}</a
  >`;
}

/** Quem estava na chamada denunciada e quem denunciou, com o aluno de cada um. */
function peopleList(
  base: string,
  report: CallReport,
  people: ReadonlyMap<string, Student>,
) {
  const known = report.people.filter(person => person.student);
  const reporter = report.reporterStudent
    ? people.get(report.reporterStudent)
    : undefined;
  if (!known.length && !reporter) return null;
  return html`<dl class="facts">
    ${known.map(person => {
      const student = people.get(person.student as string);
      return html`<div>
        <dt>${person.name}${person.host ? ' (abriu)' : ''}</dt>
        <dd>
          ${student ? studentLink(base, student) : html`<span class="quiet">aluno não encontrado</span>`}
        </dd>
      </div>`;
    })}
    ${
      reporter
        ? html`<div>
            <dt>Denunciou</dt>
            <dd>${studentLink(base, reporter)}</dd>
          </div>`
        : null
    }
  </dl>`;
}

/** O banimento em texto: "Banido até 10/12, 14:00" ou "Banido para sempre". */
function banText(student: Student, now: Date) {
  if (!student.ban || !isBanned(student.ban, now)) return null;
  return student.ban.until
    ? `Banido até ${stampFormat.format(student.ban.until)}`
    : 'Banido para sempre';
}

function studentRow(base: string, student: Student, now: Date) {
  const ban = banText(student, now);
  return html`<li class="row">
    <time class="when" datetime="${student.lastSeenAt.toISOString()}"
      >${hourFormat.format(student.lastSeenAt)}</time
    >
    <div>
      <div class="top">
        <a
          class="who"
          href="${base}/admin/alunos/${encodeURIComponent(student.id)}"
          >${student.name}</a
        >${ban ? html`<span class="source">${icon('block', 16)}${ban}</span>` : null}
      </div>
      <div class="foot">
        <span>Matrícula ${student.matricula}</span>
        <span class="quiet"
          >${count(student.devices.length, 'aparelho', 'aparelhos')}</span
        >
        <span class="quiet"
          >Desde ${stampFormat.format(student.createdAt)}</span
        >
      </div>
    </div>
  </li>`;
}

/**
 * Os alunos identificados: a busca pela matrícula, os banidos e os que
 * entraram por último. Matrícula e nome só aparecem aqui, abertos para a
 * moderação.
 */
export function studentsPage({
  base,
  csrf,
  now,
  counts,
  query,
  found,
  banned,
  recent,
}: {
  base: string;
  csrf: string;
  now: Date;
  counts: Counts;
  /** A matrícula buscada; vazia sem busca. */
  query: string;
  /** O resultado da busca: o aluno, `null` sem ninguém ou `undefined` sem busca. */
  found: Student | null | undefined;
  banned: Student[];
  recent: Student[];
}) {
  return layout({
    base,
    title: 'Alunos',
    tab: 'students',
    csrf,
    counts,
    body: html`<h1>Alunos</h1>
      <p class="lede">
        Quem entrou no app pela matrícula, com a Play Integrity. Matrícula e
        nome ficam cifrados no banco e só abrem aqui, para a moderação.
      </p>
      <form class="login" method="post" action="${base}/admin/alunos/busca">
        <input type="hidden" name="csrf" value="${csrf}" />
        <label for="matricula">Buscar pela matrícula</label>
        <input
          class="field"
          id="matricula"
          name="matricula"
          inputmode="numeric"
          autocomplete="off"
          value="${query}"
        />
        <button class="btn" type="submit">${icon('search')}Buscar</button>
      </form>
      ${
        found === undefined
          ? null
          : found
            ? html`<ol class="list">
                ${studentRow(base, found, now)}
              </ol>`
            : html`<p class="notice">
                Nenhum aluno com essa matrícula entrou no app.
              </p>`
      }
      <h2 class="sub">Banidos</h2>
      ${
        banned.length
          ? html`<ol class="list">
              ${banned.map(student => studentRow(base, student, now))}
            </ol>`
          : html`<p class="sub-lede">Ninguém banido agora.</p>`
      }
      <h2 class="sub">Entraram por último</h2>
      ${
        recent.length
          ? html`<ol class="list">
              ${recent.map(student => studentRow(base, student, now))}
            </ol>`
          : html`<p class="sub-lede">Ninguém entrou ainda.</p>`
      }`,
  });
}

/** Um aluno: os dados, os aparelhos e o banimento (banir ou desbanir). */
export function studentPage({
  base,
  csrf,
  now,
  counts,
  student,
  done,
}: {
  base: string;
  csrf: string;
  now: Date;
  counts: Counts;
  student: Student;
  /** O que acabou de ser feito, para o aviso. */
  done: 'banned' | 'unbanned' | null;
}) {
  const ban = banText(student, now);
  const action = `${base}/admin/alunos/${encodeURIComponent(student.id)}`;
  return layout({
    base,
    title: student.name,
    tab: 'students',
    csrf,
    counts,
    body: html`<a class="back link" href="${base}/admin/alunos"
        >Voltar aos alunos</a
      >
      <h1>${student.name}</h1>
      ${
        done === 'banned'
          ? html`<p class="done-notice">
              Banido. Ele saiu das mesas da Companhia (as que ele abriu
              acabaram) e não usa mural, docentes, relatos nem gerador até o fim
              do prazo. Enquanto os apps antigos valerem
              (<code>STUDENT_TOKENS=accept</code>), um deles ainda entra na
              Companhia sem dizer quem é.
            </p>`
          : done === 'unbanned'
            ? html`<p class="done-notice">
                Desbanido. Ele já pode entrar de novo.
              </p>`
            : null
      }
      <dl class="sheet">
        <dt>Matrícula</dt>
        <dd>${student.matricula}</dd>
        <dt>Primeira entrada</dt>
        <dd>${stampFormat.format(student.createdAt)}</dd>
        <dt>Última entrada</dt>
        <dd>${stampFormat.format(student.lastSeenAt)}</dd>
        <dt>Aparelhos</dt>
        <dd>
          ${count(student.devices.length, 'aparelho', 'aparelhos')}${student.devices.map(
            device =>
              html`<br /><span class="quiet"
                  >Desde ${stampFormat.format(device.firstSeenAt)}, visto em
                  ${stampFormat.format(device.lastSeenAt)}</span
                >`,
          )}
        </dd>
        <dt>Situação</dt>
        <dd>
          ${ban ? html`${ban}. Motivo: ${student.ban?.reason ?? ''}` : 'Sem banimento'}
        </dd>
      </dl>
      ${
        ban
          ? html`<form class="login" method="post" action="${action}/desbanir">
              <input type="hidden" name="csrf" value="${csrf}" />
              <button class="btn line" type="submit">
                ${icon('restart_alt')}Desbanir
              </button>
            </form>`
          : html`<form class="login" method="post" action="${action}/banir">
              <input type="hidden" name="csrf" value="${csrf}" />
              <label for="motivo">Motivo (o aluno vê)</label>
              <input
                class="field"
                id="motivo"
                name="motivo"
                maxlength="${String(STUDENT_LIMITS.banReason)}"
                required
              />
              <label for="prazo">Por quanto tempo</label>
              <select class="field" id="prazo" name="prazo">
                ${Object.entries(BAN_LABEL).map(
                  ([value, label]) =>
                    html`<option value="${value}">${label}</option>`,
                )}
              </select>
              <button class="btn" type="submit">${icon('block')}Banir</button>
            </form>`
      }`,
  });
}
