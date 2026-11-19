import { isActive } from '../../../../../modules/campus-now/domain.ts';
import type { PortalStatus } from '../../../../../modules/portal/domain.ts';
import { isBanned } from '../../../../../modules/students/domain.ts';
import type { Release } from '../status.ts';
import { tabHref, type PageContext } from './context.ts';
import {
  ago,
  count,
  dayKey,
  excerpt,
  hour,
  longDay,
  nameCase,
  stamp,
  DAY_MS,
} from './format.ts';
import { html, type Html } from './html.ts';
import {
  callTitle,
  groupTitle,
  noticeTitle,
  placeText,
  REASON_LABEL,
  SOURCE_LABEL,
} from './labels.ts';
import { emptyState, icon, row } from './pieces.ts';
import { AREAS, areaHref, shell, type AreaKey } from './shell.ts';

/* O Início (um cartão por área, lado a lado) e o Status (o portal e o servidor). */

/** Os itens que cada cartão mostra antes do "e mais". */
const CARD_ROWS = 3;

const PORTAL_STATE: Record<PortalStatus['state'], string> = {
  up: 'No ar',
  down: 'Fora do ar',
  unknown: 'Sem consulta ainda',
};

/** O portal ou o banco com problema (a lâmpada do Status). */
export const portalTrouble = (portal: PortalStatus) => portal.state === 'down';

function card(
  base: string,
  area: AreaKey,
  countText: string,
  asks: boolean,
  body: Html,
  foot: Html | null,
) {
  return html`<section class="acard" aria-label="${AREAS[area].label}">
    <a class="acard-h" href="${areaHref(base, area)}"
      >${icon(AREAS[area].icon)}<b>${AREAS[area].label}</b
      ><span class="n${asks ? '' : ' zero'}">${countText}</span
      >${icon('chevron_right', true)}</a
    >
    <div class="acard-b">${body}</div>
    <div class="acard-f">${foot ?? null}</div>
  </section>`;
}

const more = (base: string, area: AreaKey, rest: number) =>
  rest > 0
    ? html`<a class="more-line" href="${areaHref(base, area)}"
        >e mais ${rest}</a
      >`
    : null;
const calm = (text: string) => html`<p class="calm">${text}</p>`;
const asksText = (n: number) =>
  n ? count(n, 'pede você', 'pedem você') : 'nada pede você';

export function homePage(
  ctx: PageContext,
  { portal }: { portal: PortalStatus },
) {
  const { base, desk, now, csrf } = ctx;
  const { companion, campus, reports, suggestions, banned } = desk;
  const companionRows = companion.asks.slice(0, CARD_ROWS).map(entry =>
    row({
      href: tabHref(base, 'companhia', 'fila', 'fila', entry.callId),
      selected: false,
      lamp: 'on',
      title: `${REASON_LABEL[entry.latest.reason]}: ${callTitle(entry.latest)}`,
      meta: entry.latest.source
        ? SOURCE_LABEL[entry.latest.source]
        : 'Denúncia',
      age: ago(entry.latest.createdAt, now),
    }),
  );
  const campusRows = campus.asks.slice(0, CARD_ROWS).map(notice =>
    row({
      href: tabHref(base, 'agora', 'fila', 'fila', notice.id),
      selected: false,
      lamp: isActive(notice, now) ? 'on' : 'ask',
      title: noticeTitle(notice),
      meta: `${placeText(notice.place)} · ${count(notice.flags, 'denúncia', 'denúncias')}`,
      age: ago(notice.createdAt, now),
    }),
  );
  const reportRows = reports.slice(0, CARD_ROWS).map(group =>
    row({
      href: tabHref(base, 'relatos', 'fila', 'fila', group.key),
      selected: false,
      lamp: null,
      title: groupTitle(group),
      meta: group.page,
      age: ago(group.last, now),
      times: group.reports.length,
    }),
  );
  const suggestionRows = suggestions.fresh.slice(0, CARD_ROWS).map(suggestion =>
    row({
      href: tabHref(base, 'sugestoes', 'fila', 'fila', suggestion.id),
      selected: false,
      lamp: null,
      title: excerpt(suggestion.content, 70),
      meta: suggestion.name,
      age: ago(suggestion.createdAt, now),
    }),
  );
  const bannedRows = banned.slice(0, CARD_ROWS).map(student =>
    row({
      href: `${areaHref(base, 'alunos')}/${encodeURIComponent(student.id)}`,
      selected: false,
      lamp: 'ask',
      title: nameCase(student.name),
      meta: `${student.matricula} · ${student.ban?.reason ?? ''}`,
      age:
        student.ban && isBanned(student.ban, now)
          ? student.ban.until
            ? `faltam ${Math.max(1, Math.ceil((student.ban.until.getTime() - now.getTime()) / DAY_MS))} d`
            : 'para sempre'
          : '',
    }),
  );
  const totalReports = reports.reduce(
    (sum, group) => sum + group.reports.length,
    0,
  );
  const reportsToday = reports.reduce(
    (sum, group) =>
      sum +
      group.reports.filter(report => dayKey(report.createdAt) === dayKey(now))
        .length,
    0,
  );
  const listed = companion.listed.length;
  const live = campus.moderation.live.length;
  const air = (n: number, one: string, many: string) =>
    html`<i class="lamp${n ? ' on' : ''}"></i
      ><span class="${n ? 'live' : ''}"
        >${n ? count(n, one, many) : 'nada no ar'}</span
      >`;
  const trouble = portalTrouble(portal);

  const body = html`<div class="home">
    <section class="hgroup g3">
      <h2>Moderação</h2>
      ${card(base, 'companhia', asksText(companion.asks.length), companion.asks.length > 0, companionRows.length ? html`${companionRows}${more(base, 'companhia', companion.asks.length - CARD_ROWS)}` : calm('Nenhuma denúncia.'), air(listed, 'mesa ou grupo no ar', 'mesas e grupos no ar'))}
      ${card(base, 'agora', asksText(campus.asks.length), campus.asks.length > 0, campusRows.length ? html`${campusRows}${more(base, 'agora', campus.asks.length - CARD_ROWS)}` : calm('Nenhum aviso denunciado.'), air(live, 'aviso valendo', 'avisos valendo'))}
      ${card(base, 'alunos', count(banned.length, 'banido', 'banidos'), false, bannedRows.length ? html`${bannedRows}${more(base, 'alunos', banned.length - CARD_ROWS)}` : calm('Ninguém banido.'), null)}
    </section>
    <section class="hgroup g2">
      <h2>Suporte</h2>
      ${card(base, 'relatos', reports.length ? count(reports.length, 'grupo aberto', 'grupos abertos') : 'nada aberto', reports.length > 0, reportRows.length ? html`${reportRows}${more(base, 'relatos', reports.length - CARD_ROWS)}` : calm('Nenhum relato aberto.'), totalReports ? html`<span>${count(totalReports, 'relato', 'relatos')} · ${count(reportsToday, 'hoje', 'hoje')}</span>` : null)}
      ${card(base, 'sugestoes', suggestions.fresh.length ? count(suggestions.fresh.length, 'nova', 'novas') : 'nada novo', suggestions.fresh.length > 0, suggestionRows.length ? html`${suggestionRows}${more(base, 'sugestoes', suggestions.fresh.length - CARD_ROWS)}` : calm('Nenhuma sugestão nova.'), null)}
    </section>
    <section class="hgroup">
      <h2>Sistema</h2>
      ${card(
        base,
        'status',
        trouble ? 'algo fora do ar' : 'tudo no ar',
        trouble,
        html`<dl class="facts">
          <dt>Aluno Online</dt>
          <dd class="${trouble ? 'ask-t' : ''}">
            ${PORTAL_STATE[portal.state]}${portal.since ? ` desde ${hour(new Date(portal.since))}` : ''}
          </dd>
          <dt>Banco</dt>
          <dd>conectado</dd>
        </dl>`,
        null,
      )}
    </section>
  </div>`;
  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'inicio',
    title: 'Início',
    summary: html`<span>${longDay(now)}</span>`,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}

export function statusPage({
  base,
  csrf,
  counts,
  portal,
  database,
  release,
  startedAt,
  openLayoutGroups,
  palette,
}: {
  base: string;
  csrf: string;
  counts: PageContext['counts'] | null;
  portal: PortalStatus;
  /** O estado do banco, como o `/status` diz ("connected"…). */
  database: { ready: boolean; status: string };
  release: Release;
  startedAt: Date;
  /** Os grupos de relatos abertos com a página do portal mudada. */
  openLayoutGroups: number;
  palette?: PageContext['palette'];
}) {
  const trouble = portalTrouble(portal);
  const body = html`<div class="status">
    <section class="panel" aria-label="Aluno Online">
      <div class="bar">
        <h2>Aluno Online</h2>
        <span class="count">o portal da UERJ, visto pelo servidor</span>
      </div>
      <div class="np">
        <div class="st-big">
          <b class="${trouble ? 'ask' : ''}">${PORTAL_STATE[portal.state]}</b
          >${portal.since ? html`<span>desde ${stamp(new Date(portal.since))}</span>` : null}
        </div>
        <p class="hint">
          ${portal.checkedAt ? `Última consulta às ${hour(new Date(portal.checkedAt))}.` : 'O servidor ainda não consultou o portal.'}
        </p>
        ${
          openLayoutGroups && !trouble
            ? html`<div class="st-note">
                ${icon('warning', true)}<span
                  >A página do portal mudou para o app:
                  ${count(openLayoutGroups, 'grupo de relatos aberto', 'grupos de relatos abertos')}.</span
                ><a class="btn" href="${areaHref(base, 'relatos')}"
                  >Ver em Relatos</a
                >
              </div>`
            : null
        }
      </div>
    </section>
    <section class="panel" aria-label="Servidor">
      <div class="bar"><h2>Servidor</h2></div>
      <div class="np">
        <dl class="facts" style="margin:0">
          <dt>Banco</dt>
          <dd class="${database.ready ? '' : 'ask-t'}">
            ${database.ready ? 'conectado' : `fora do ar (${database.status})`}
          </dd>
          <dt>Versão no ar</dt>
          <dd>
            ${release.commit ? html`<span class="code">${release.commit.slice(0, 7)}</span>` : 'sem a versão'}${release.color ? `, lado ${release.color === 'blue' ? 'azul' : 'verde'}` : ''}
          </dd>
          <dt>No ar desde</dt>
          <dd>${stamp(startedAt)}</dd>
        </dl>
      </div>
    </section>
  </div>`;
  return shell({
    base,
    csrf,
    counts,
    area: 'status',
    title: 'Status',
    summary: html`<span class="${trouble ? 'ask' : ''}"
        >Aluno Online ${PORTAL_STATE[portal.state].toLowerCase()}</span
      ><span class="${database.ready ? '' : 'ask'}"
        >banco ${database.ready ? 'conectado' : 'fora do ar'}</span
      >`,
    body,
    palette,
  });
}

export { emptyState };
