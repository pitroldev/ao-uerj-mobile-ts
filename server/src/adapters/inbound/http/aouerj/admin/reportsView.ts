import type { ErrorReport } from '../../../../../modules/reports/domain.ts';
import type {
  ReportGroup,
  ReviewedReport,
} from '../../../../../modules/reports/ports.ts';
import { pick, positionOf, tabHref, type PageContext } from './context.ts';
import { ago, count, dayKey, statDay, when } from './format.ts';
import { html, type Html } from './html.ts';
import {
  GENERATOR_STEPS,
  generatorSummary,
  groupCode,
  groupTitle,
  kib,
  shortId,
} from './labels.ts';
import {
  actionButton,
  csrfField,
  emptyPreview,
  emptyState,
  horizontalBars,
  icon,
  legend,
  listPanel,
  personLink,
  preview,
  row,
} from './pieces.ts';
import { shell } from './shell.ts';

/* Relatos: os abertos agrupados pelo erro, os resolvidos e os números. */

export type ReportsTab = 'fila' | 'feitos' | 'numeros';
export const REPORTS_TABS: ReportsTab[] = ['fila', 'feitos', 'numeros'];

/** Os relatos que a prévia mostra antes do "Mostrar todos". */
const SHOWN_REPORTS = 5;

/** O diagnóstico de um relato (o primeiro anexo que é um). */
const diagnosticOf = (report: ReviewedReport) =>
  report.attachments.find(attachment => attachment.kind === 'diagnostic')
    ?.diagnostic ?? null;

/** "9 relatos de 8 alunos" e os sem identificação. */
function whoCount(group: ReportGroup) {
  const people = group.students
    ? ` de ${count(group.students, 'aluno', 'alunos')}${group.anonymous ? ` e ${group.anonymous} sem identificação` : ''}`
    : group.anonymous
      ? ', sem identificação'
      : '';
  return `${count(group.reports.length, 'relato', 'relatos')}${people}`;
}

/** O resumo para abrir uma issue: em Markdown, sem nome, matrícula nem e-mail. */
export function issueSummary(group: ReportGroup, now: Date) {
  const diagnostic = group.diagnostic;
  const lines = [
    `**${groupTitle(group)}** (${group.page})`,
    '',
    `- ${groupCode(group)}`,
    `- ${whoCount(group)}, desde ${when(group.first, now)}`,
  ];
  if (group.versions.length)
    lines.push(
      `- versões: ${group.versions.map(item => `${item.version} (${item.reports})`).join(', ')}`,
    );
  if (group.updates.length)
    lines.push(
      `- OTA: ${group.updates.map(item => `${shortId(item.id)} (${item.reports})`).join(', ')}`,
    );
  if (diagnostic) lines.push(`- leitura do portal ${diagnostic.parserVersion}`);
  if (diagnostic?.generator)
    lines.push(`- gerador: ${generatorSummary(diagnostic.generator)}`);
  return lines.join('\n');
}

function attachmentLinks(base: string, report: ReviewedReport) {
  return report.attachments.map((attachment, index) => {
    const href = `${base}/admin/relatos/${encodeURIComponent(report.id)}/anexos/${encodeURIComponent(attachment.id)}`;
    const number = report.attachments.length > 1 ? ` ${index + 1}` : '';
    if (attachment.kind === 'missing')
      return html`<span class="quiet">Anexo${number} não encontrado</span>`;
    const label =
      attachment.kind === 'diagnostic'
        ? `Diagnóstico${number}`
        : `Página do portal${number} · ${kib(attachment.bytes)}`;
    return html`<a href="${href}" target="_blank" rel="noopener noreferrer"
      >${icon('open_in_new', true)}${label}</a
    >`;
  });
}

export function reportsPage(
  ctx: PageContext,
  {
    tab,
    item,
    resolved,
    recent,
    showAll,
  }: {
    tab: ReportsTab;
    item: string | undefined;
    /** Os grupos resolvidos (só na aba deles). */
    resolved: ReportGroup[] | null;
    /** Os relatos dos últimos 14 dias (só nos números). */
    recent: ErrorReport[] | null;
    showAll: boolean;
  },
) {
  const { base, desk, now, csrf } = ctx;
  const open = desk.reports;
  const href = (
    to: ReportsTab,
    id?: string | null,
    extra: Record<string, string> = {},
  ) => tabHref(base, 'relatos', to, 'fila', id, extra);
  const total = open.reduce((sum, group) => sum + group.reports.length, 0);
  const students = open.reduce((sum, group) => sum + group.students, 0);
  const today = open.reduce(
    (sum, group) =>
      sum +
      group.reports.filter(report => dayKey(report.createdAt) === dayKey(now))
        .length,
    0,
  );

  const tabs = [
    {
      key: 'fila',
      label: 'Abertos',
      href: href('fila'),
      n: open.length,
      ask: true,
    },
    { key: 'feitos', label: 'Resolvidos', href: href('feitos') },
    { key: 'numeros', label: 'Números', href: href('numeros') },
  ];
  const summary = total
    ? html`<span
          >${count(total, 'relato', 'relatos')}${students ? ` de ${count(students, 'aluno', 'alunos')}` : ''},
          em ${count(open.length, 'grupo', 'grupos')}</span
        ><span>${count(today, 'hoje', 'hoje')}</span>`
    : html`<span>nenhum relato aberto</span>`;

  const groupPreview = (group: ReportGroup, ids: string[], isOpen: boolean) => {
    const diagnostic = group.diagnostic;
    const shown = showAll
      ? group.reports
      : group.reports.slice(0, SHOWN_REPORTS);
    const hidden = group.reports.length - shown.length;
    const totalVersions = group.versions.reduce(
      (sum, version) => sum + version.reports,
      0,
    );
    const withPage = group.reports.find(
      report =>
        diagnosticOf(report)?.pages?.length &&
        report.attachments.some(attachment => attachment.kind === 'page'),
    );
    const page = withPage?.attachments.find(
      attachment => attachment.kind === 'page',
    );
    const pageName = withPage ? diagnosticOf(withPage)?.pages?.[0] : undefined;
    const index = ids.indexOf(group.key);
    const next = ids[index + 1] ?? ids[index - 1] ?? null;
    const selfHref = href(tab, group.key);
    const back = html`<input
        type="hidden"
        name="volta"
        value="${group.key}"
      /><input type="hidden" name="aba" value="${tab}" />`;
    const run = diagnostic?.generator;
    const body = html`<h1 class="ttl">${groupTitle(group)}</h1>
      <div class="sub">
        <span class="tag">${group.page}</span
        ><span class="code">${groupCode(group)}</span>
      </div>
      <p class="lede">
        <b>${whoCount(group)}</b> ·
        ${group.reports.length > 1 ? `desde ${when(group.first, now)} · o último ${when(group.last, now)}` : when(group.last, now)}
      </p>
      ${
        run
          ? html`<h3 class="sec">Onde o aluno parou no gerador</h3>
              <div class="steps">
                ${GENERATOR_STEPS.map((step, at) =>
                  at < run.step
                    ? html`<span>${icon('check_circle')}${step}</span
                        >${icon('chevron_right')}`
                    : at === run.step
                      ? html`<span class="stop">${step}</span>`
                      : null,
                )}
              </div>
              <p class="vers-note">${generatorSummary(run)}</p>`
          : null
      }
      ${
        group.versions.length
          ? html`<h3 class="sec">Versões do app</h3>
              <div class="vers">
                ${group.versions.map(version => html`<div style="flex:${version.reports}" title="${count(version.reports, 'relato', 'relatos')}">${version.version} · ${version.reports}</div>`)}
              </div>
              <p class="vers-note">
                ${group.updates.length ? group.updates.map(update => `${update.reports} de ${totalVersions} com a OTA ${shortId(update.id)}`).join(' · ') : 'Sem OTA'}${diagnostic ? ` · leitura do portal ${diagnostic.parserVersion}` : ''}
              </p>`
          : null
      }
      ${
        withPage && page
          ? html`<h3 class="sec">A página do portal, anonimizada no celular</h3>
              <div class="page-view">
                <div class="page-tabs">
                  ${icon('description', true)}<span class="on"
                    >${pageName ?? 'página'}</span
                  ><span
                    >${page.kind === 'page' ? kib(page.bytes) : ''} · do relato
                    de ${when(withPage.createdAt, now)}</span
                  >
                  <a
                    class="btn ghost"
                    href="${base}/admin/relatos/${encodeURIComponent(withPage.id)}/anexos/${encodeURIComponent(page.id)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    >${icon('open_in_new', true)}Abrir inteira</a
                  >
                </div>
                <iframe
                  sandbox=""
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  title="A página do portal, anonimizada"
                  src="${base}/admin/relatos/${encodeURIComponent(withPage.id)}/anexos/${encodeURIComponent(page.id)}"
                ></iframe>
              </div>`
          : null
      }
      <h3 class="sec">Os relatos</h3>
      <ul class="reports">
        ${shown.map(report => {
          const student = report.studentId
            ? ctx.people.get(report.studentId)
            : undefined;
          const done = report.resolvedAt !== null;
          return html`<li id="relato-${report.id}">
            <time datetime="${report.createdAt.toISOString()}"
              >${when(report.createdAt, now)}</time
            >
            <div>
              ${report.description ? html`<p><span class="pre">${report.description}</span></p>` : html`<p class="none">Sem descrição.</p>`}${diagnosticOf(report)?.subjectCode ? html`<p class="vers-note">Disciplina ${diagnosticOf(report)!.subjectCode}</p>` : null}
              <div class="who">
                ${student ? personLink(base, student, selfHref) : html`<span class="quiet">sem identificação</span>`}${report.email ? html`<a href="mailto:${report.email}">${icon('mail', true)}${report.email}</a>` : null}${attachmentLinks(base, report)}
              </div>
            </div>
            <form
              method="post"
              action="${base}/admin/relatos/${encodeURIComponent(report.id)}/${done ? 'reabrir' : 'resolver'}"
            >
              ${csrfField(csrf)}${back}<button
                class="btn ghost small"
                type="submit"
              >
                ${done ? 'Reabrir' : 'Resolver'}
              </button>
            </form>
          </li>`;
        })}
      </ul>
      ${hidden > 0 ? html`<p><a class="btn ghost" href="${href(tab, group.key, { todos: '1' })}">Mostrar os outros ${hidden}</a></p>` : null}`;
    const copy = html`<button
      class="btn no-js-hide"
      type="button"
      data-copy="${issueSummary(group, now)}"
    >
      ${icon('content_copy', true)}<span data-label
        >Copiar resumo para issue</span
      >
    </button>`;
    const dock = isOpen
      ? html`${copy}<span class="gap"></span>${actionButton({
            action: `${base}/admin/relatos/grupos/${encodeURIComponent(group.key)}/resolver`,
            csrf,
            label:
              group.reports.length > 1
                ? `Resolver os ${group.reports.length}`
                : 'Resolver',
            iconName: 'check_circle',
            primary: true,
            hidden: html`<input
                type="hidden"
                name="aba"
                value="${tab}"
              />${next ? html`<input type="hidden" name="proximo" value="${next}" />` : null}`,
          })}`
      : html`${copy}<span class="gap"></span>${actionButton({
            action: `${base}/admin/relatos/grupos/${encodeURIComponent(group.key)}/reabrir`,
            csrf,
            label:
              group.reports.length > 1
                ? `Reabrir os ${group.reports.length}`
                : 'Reabrir',
            iconName: 'restart_alt',
            hidden: html`<input type="hidden" name="aba" value="${tab}" />`,
          })}`;
    return preview({
      id: '',
      what: group.page,
      position: positionOf(ids, group.key, id => href(tab, id)),
      body,
      dock,
    });
  };

  const groupList = (
    groups: ReportGroup[],
    to: ReportsTab,
    selected: ReportGroup | undefined,
  ) =>
    groups.map(group =>
      row({
        href: href(to, group.key),
        selected: group === selected,
        lamp: null,
        title: groupTitle(group),
        meta: `${group.page}${group.versions.length ? ` · ${group.versions.map(version => version.version).join(', ')}` : ''}`,
        age: ago(
          to === 'feitos' && group.resolvedAt ? group.resolvedAt : group.last,
          now,
        ),
        times: group.reports.length,
      }),
    );

  let body: Html;
  if (tab === 'numeros') body = numbersView(open, recent ?? [], now);
  else {
    const isOpen = tab === 'fila';
    const groups = isOpen ? open : (resolved ?? []);
    const ids = groups.map(group => group.key);
    const selected = pick(groups, group => group.key, item);
    body = html`<div class="desk">
      ${listPanel({
        id: `relatos:${tab}`,
        countLine: groups.length
          ? isOpen
            ? `${count(groups.length, 'grupo', 'grupos')} · o maior primeiro`
            : `${count(groups.length, 'grupo', 'grupos')} · o resolvido por último primeiro`
          : 'vazia',
        cuts: false,
        body: groups.length
          ? html`${groupList(groups, tab, selected)}`
          : isOpen
            ? emptyState('task_alt', 'Nenhum relato aberto', {
                href: href('feitos'),
                label: 'Ver os resolvidos',
              })
            : emptyState('history', 'Nenhum relato resolvido ainda'),
      })}
      ${selected ? groupPreview(selected, ids, isOpen) : emptyPreview('Nada aqui agora')}
    </div>`;
  }
  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'relatos',
    title: 'Relatos',
    summary,
    tabs,
    tab,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}

/** Os relatos por tela (14 dias, na mesma escala) e por versão (os abertos). */
function numbersView(open: ReportGroup[], recent: ErrorReport[], now: Date) {
  const today = dayKey(now);
  const pages = new Map<string, { total: number; today: number }>();
  for (const report of recent) {
    const entry = pages.get(report.page) ?? { total: 0, today: 0 };
    entry.total += 1;
    if (dayKey(report.createdAt) === today) entry.today += 1;
    pages.set(report.page, entry);
  }
  const screens = [...pages].sort((a, b) => b[1].total - a[1].total);
  const versions = new Map<string, number>();
  const updates = new Map<string, number>();
  for (const group of open) {
    for (const version of group.versions)
      versions.set(
        version.version,
        (versions.get(version.version) ?? 0) + version.reports,
      );
    for (const update of group.updates)
      updates.set(update.id, (updates.get(update.id) ?? 0) + update.reports);
  }
  const byVersion = [...versions].sort((a, b) => b[1] - a[1]);
  return html`<div class="nums">
    <section class="panel wide" aria-label="Números dos relatos">
      <div class="bar">
        <h2>Últimos 14 dias</h2>
        <span class="count"
          >${count(recent.length, 'relato', 'relatos')} · desde
          ${statDay(dayKey(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)))}</span
        >
      </div>
      <div class="np-grid">
        <div class="np">
          <h3>Por tela</h3>
          <p class="hint">Na mesma escala.</p>
          ${
            screens.length
              ? html`${legend('antes de hoje', 'hoje')}${horizontalBars(screens.map(([page, entry]) => ({ label: page, total: entry.total, part: entry.today, note: entry.today ? `${entry.today} hoje` : '' })))}`
              : html`<p class="hint">Nenhum relato nesses dias.</p>`
          }
        </div>
        <div class="np-col">
          <div class="np">
            <h3>Por versão do app</h3>
            <p class="hint">Dos relatos abertos com diagnóstico.</p>
            ${
              byVersion.length
                ? html`<div class="vers">
                      ${byVersion.map(([version, n]) => html`<div style="flex:${n}">${version} · ${n}</div>`)}
                    </div>
                    <p class="vers-note">
                      ${
                        [...updates]
                          .sort((a, b) => b[1] - a[1])
                          .map(([id, n]) => `${n} com a OTA ${shortId(id)}`)
                          .join(' · ') || 'Nenhum com OTA'
                      }
                    </p>`
                : html`<p class="hint">
                    Nenhum relato aberto com diagnóstico.
                  </p>`
            }
          </div>
        </div>
      </div>
    </section>
  </div>`;
}
