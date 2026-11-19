import {
  MEMBER_REPORTS_TO_HIDE,
  type DayStats,
  type ListedCall,
} from '../../../../../modules/companion/domain.ts';
import { pick, positionOf, tabHref, type PageContext } from './context.ts';
import type { CallCase } from './desk.ts';
import { ago, count, hour, percent, statDay, when } from './format.ts';
import { html, trusted, type Html } from './html.ts';
import {
  CALL_ICON,
  callTitle,
  callWord,
  REASON_LABEL,
  SOURCE_LABEL,
} from './labels.ts';
import { personCard } from './people.ts';
import {
  actionButton,
  block,
  emptyPreview,
  emptyState,
  icon,
  legend,
  listPanel,
  preview,
  programMonitor,
  row,
  stackBars,
  take,
} from './pieces.ts';
import { areaHref, shell } from './shell.ts';

/* Companhia agora: as denúncias, o que está no ar, o que já foi feito e os números. */

export type CompanionTab = 'fila' | 'noar' | 'feitos' | 'numeros';
export const COMPANION_TABS: CompanionTab[] = [
  'fila',
  'noar',
  'feitos',
  'numeros',
];

/** Quantos dias de números a aba mostra. */
export const COMPANION_STATS_DAYS = 14;

const NO_WAY_BACK = html`Some agora, e quem está dentro vê que acabou.
  <b>Não tem volta.</b>`;

/** A regra da denúncia que chegou por último, numa frase. */
function ruleText(item: CallCase) {
  const source = item.latest.source;
  if (source === 'outsider')
    return 'a denúncia de fora não tira sozinha: a decisão é sua';
  if (source === 'host')
    return 'a de quem abriu não tira sozinha: a decisão é sua';
  if (source === 'member') {
    const inside = item.reports.filter(
      report => report.source === 'member',
    ).length;
    return `${inside} de ${MEMBER_REPORTS_TO_HIDE} denúncias de dentro para sair sozinha`;
  }
  return 'a decisão é sua';
}

const decision = (item: CallCase) => {
  const word = callWord(item.latest);
  if (item.hidden)
    return item.hiddenBy === 'moderation'
      ? 'Você tirou do ar.'
      : item.hiddenBy === 'reports'
        ? `Saiu do ar sozinh${word.the} pelas denúncias de quem foi junto.`
        : 'Saiu do ar.';
  return `Você manteve no ar e arquivou ${item.reports.length > 1 ? 'as denúncias' : 'a denúncia'}.`;
};

function appCard(
  call: {
    kind: ListedCall['kind'];
    at: Date;
    spot: ListedCall['spot'];
    destination: ListedCall['destination'];
    note: string;
  },
  people: Array<{ name: string; host: boolean }>,
) {
  const host =
    people.find(person => person.host)?.name ?? people[0]?.name ?? '';
  return html`<div class="app-card">
    <div class="ac-t">
      ${icon(CALL_ICON(call))}${callTitle(call).replace(', ', ' · ')}
    </div>
    <div class="ac-m">
      ${host}${people.length > 1 ? ` e mais ${people.length - 1}` : ''}
    </div>
    ${call.note ? html`<div class="ac-p">"${call.note}"</div>` : null}
    <div class="ac-b"><span>Entrar</span></div>
  </div>`;
}

export function companionPage(
  ctx: PageContext,
  {
    tab,
    item,
    stats,
  }: { tab: CompanionTab; item: string | undefined; stats: DayStats[] | null },
) {
  const { base, desk, now, csrf } = ctx;
  const { asks, listed, done, cases } = desk.companion;
  const href = (to: CompanionTab, id?: string | null) =>
    tabHref(base, 'companhia', to, 'fila', id);
  const caseOf = new Map(cases.map(entry => [entry.callId, entry]));
  const pendingOf = (callId: string) => caseOf.get(callId)?.pending ?? false;

  const tabs = [
    {
      key: 'fila',
      label: 'Pedem você',
      href: href('fila'),
      n: asks.length,
      ask: true,
    },
    { key: 'noar', label: 'No ar agora', href: href('noar'), n: listed.length },
    { key: 'feitos', label: 'Feitos', href: href('feitos') },
    { key: 'numeros', label: 'Números', href: href('numeros') },
  ];
  const summary = html`<span class="live"
      ><i class="lamp on"></i
      >${count(listed.length, 'mesa ou grupo no ar', 'mesas e grupos no ar')}</span
    >${
      asks.length
        ? html`<span class="ask"
            >${count(asks.length, 'denúncia pede você', 'denúncias pedem você')}</span
          >`
        : html`<span>nenhuma denúncia</span>`
    }`;

  /** Os campos que levam de volta à aba, no próximo item. */
  const back = (next: string | null) =>
    html`<input
        type="hidden"
        name="aba"
        value="${tab}"
      />${next ? html`<input type="hidden" name="proximo" value="${next}" />` : null}`;
  const nextOf = (ids: string[], id: string) => {
    const index = ids.indexOf(id);
    return ids[index + 1] ?? ids[index - 1] ?? null;
  };

  const casePreview = (entry: CallCase, ids: string[]) => {
    const { latest } = entry;
    const word = callWord(latest);
    const people = latest.people.length
      ? latest.people
      : latest.names.map(name => ({ name, host: false, student: null }));
    const reporters = [
      ...new Set(
        entry.reports.flatMap(report =>
          report.reporterStudent ? [report.reporterStudent] : [],
        ),
      ),
    ];
    const selfHref = href(tab, entry.callId);
    const left = html`<h1 class="ttl">${REASON_LABEL[latest.reason]}</h1>
      <div class="sub">
        ${latest.source ? html`<span class="tag">${SOURCE_LABEL[latest.source]}</span>` : null}<span
          >denunciad${word.the} às ${hour(latest.createdAt)}</span
        ><span>${ruleText(entry)}</span>
      </div>
      ${
        entry.reports.length > 1
          ? html`<h3 class="sec">
                As denúncias <span class="quiet">${entry.reports.length}</span>
              </h3>
              <ul class="calls">
                ${entry.reports.map(
                  report =>
                    html`<li>
                      <time>${when(report.createdAt, now)}</time
                      ><span>${REASON_LABEL[report.reason]}</span
                      >${report.source ? html`<span class="quiet">${SOURCE_LABEL[report.source]}</span>` : null}
                    </li>`,
                )}
              </ul>`
          : null
      }
      <h3 class="sec">
        Quem estava
        <span class="quiet">${count(people.length, 'pessoa', 'pessoas')}</span>
      </h3>
      ${people.map(person =>
        personCard({
          base,
          student: person.student ? ctx.people.get(person.student) : undefined,
          facts: ctx.facts,
          now,
          nick: person.name,
          role: person.host ? 'abriu' : 'entrou',
          back: selfHref,
          missing: person.student
            ? 'aluno não encontrado'
            : 'app antigo, sem identificação',
        }),
      )}
      <h3 class="sec">Quem denunciou</h3>
      ${
        reporters.length
          ? reporters.map(id =>
              personCard({
                base,
                student: ctx.people.get(id),
                facts: ctx.facts,
                now,
                back: selfHref,
                missing: 'aluno não encontrado',
              }),
            )
          : html`<p class="private">
              ${icon('lock', true)}Denúncia de um app antigo, sem identificação.
            </p>`
      }`;
    const right = programMonitor({
      liveUntil: entry.alive ? `até ${hour(latest.callExpiresAt!)}` : null,
      off: !entry.alive,
      card: appCard(latest, people),
      caption: 'Os outros alunos veem só os nomes que cada um escolheu.',
    });
    const next = nextOf(ids, entry.callId);
    const cut = take({
      action: `${base}/admin/companhia/${encodeURIComponent(entry.callId)}/tirar`,
      csrf,
      why: NO_WAY_BACK,
      label: 'Segure para tirar de vez',
      final: true,
      hidden: back(next),
    });
    let dock: Html | null;
    if (entry.pending)
      dock = html`${actionButton({ action: `${base}/admin/companhia/${encodeURIComponent(entry.callId)}/manter`, csrf, label: 'Manter no ar', iconName: 'check_circle', primary: true, hidden: back(next) })}<span
          class="hint"
          >arquiva a denúncia</span
        ><span class="gap"></span>${cut}`;
    else if (entry.alive)
      dock = html`<span class="hint"
          >denúncia
          arquivada${entry.reviewedAt ? ` às ${hour(entry.reviewedAt)}` : ''}</span
        ><span class="gap"></span>${cut}`;
    else
      dock = html`<span class="hint"
        >${entry.hidden ? 'Saiu do ar.' : 'Já acabou.'}</span
      >`;
    return preview({
      id: tab === 'noar' ? callTitle(latest) : '',
      what:
        tab === 'noar'
          ? `${word.noun} denunciad${word.the}`
          : `denúncia d${word.the} ${callTitle(latest)}`,
      position: positionOf(ids, entry.callId, id => href(tab, id)),
      body: html`<div class="pv-grid">
        <div>${left}</div>
        <div>${right}</div>
      </div>`,
      dock,
    });
  };

  const listedPreview = (call: ListedCall, ids: string[]) => {
    const word = callWord(call);
    const left = html`<h1 class="ttl">${callTitle(call)}</h1>
      <div class="sub">
        <span class="tag"
          >${icon(CALL_ICON(call), true)}${call.people.length > 1 ? 'com companhia' : 'esperando companhia'}</span
        ><span
          >${count(call.people.length, 'pessoa', 'pessoas')} de
          ${call.capacity}</span
        ><span>sai da lista às ${hour(call.listedUntil)}</span>
      </div>
      <h3 class="sec">Quem está</h3>
      <div class="nicks">
        ${call.people.map(person => html`<span><b>${person.name}</b>${person.host ? 'abriu' : 'entrou'}</span>`)}
      </div>
      <p class="private">
        ${icon('lock', true)}Sem denúncia, você vê só os nomes que eles
        escolheram.
      </p>`;
    const right = programMonitor({
      liveUntil: `até ${hour(call.listedUntil)}`,
      card: appCard(call, call.people),
    });
    const next = nextOf(ids, call.id);
    return preview({
      id: '',
      what: `${word.noun} no ar`,
      position: positionOf(ids, call.id, id => href(tab, id)),
      body: html`<div class="pv-grid">
        <div>${left}</div>
        <div>${right}</div>
      </div>`,
      dock: html`<span class="hint">sem denúncia</span
        ><span class="gap"></span>${take({
          action: `${base}/admin/companhia/${encodeURIComponent(call.id)}/tirar`,
          csrf,
          why: NO_WAY_BACK,
          label: 'Segure para tirar de vez',
          final: true,
          hidden: back(next),
        })}`,
    });
  };

  const donePreview = (entry: CallCase, ids: string[]) =>
    preview({
      id: '',
      what: 'feito',
      position: positionOf(ids, entry.callId, id => href(tab, id)),
      body: html`<h1 class="ttl">${callTitle(entry.latest)}</h1>
        <div class="sub">
          <span class="tag">${REASON_LABEL[entry.latest.reason]}</span
          ><span>${count(entry.reports.length, 'denúncia', 'denúncias')}</span>
        </div>
        <p class="lede">${decision(entry)}</p>`,
      dock:
        !entry.hidden && entry.alive
          ? html`<span class="gap"></span
              >${actionButton({ action: `${base}/admin/companhia/${encodeURIComponent(entry.callId)}/reabrir`, csrf, label: 'Devolver à moderação', iconName: 'restart_alt', hidden: back(null) })}`
          : html`<span class="gap"></span
              ><span class="hint">Não há como voltar atrás nessa.</span>`,
    });

  let body: Html;
  if (tab === 'numeros') body = statsView(stats ?? []);
  else if (tab === 'fila') {
    const ids = asks.map(entry => entry.callId);
    const selected = pick(asks, entry => entry.callId, item);
    body = html`<div class="desk">
      ${listPanel({
        id: 'companhia:fila',
        countLine: asks.length
          ? `${count(asks.length, 'denúncia', 'denúncias')} · a mais nova primeiro`
          : 'vazia',
        cuts: true,
        body: asks.length
          ? html`${asks.map(entry =>
              row({
                href: href('fila', entry.callId),
                selected: entry === selected,
                lamp: 'on',
                title: `${REASON_LABEL[entry.latest.reason]}: ${callTitle(entry.latest)}`,
                meta: `${entry.latest.source ? SOURCE_LABEL[entry.latest.source] : 'Denúncia'} · ${entry.reports.length > 1 ? `${entry.reports.length} denúncias · ` : ''}${ruleText(entry)}`,
                age: ago(entry.latest.createdAt, now),
              }),
            )}`
          : emptyState('task_alt', 'Nenhuma denúncia pede você', {
              href: href('noar'),
              label: 'Ver o que está no ar',
            }),
      })}
      ${selected ? casePreview(selected, ids) : emptyPreview('Nada aqui agora')}
    </div>`;
  } else if (tab === 'noar') {
    const ordered = [...listed].sort(
      (a, b) =>
        Number(pendingOf(b.id)) - Number(pendingOf(a.id)) ||
        a.listedUntil.getTime() - b.listedUntil.getTime(),
    );
    const ids = ordered.map(call => call.id);
    const selected = pick(ordered, call => call.id, item);
    const withReports = ordered.filter(call => pendingOf(call.id));
    const without = ordered.filter(call => !pendingOf(call.id));
    const line = (call: ListedCall) => {
      const entry = caseOf.get(call.id);
      return row({
        href: href('noar', call.id),
        selected: call === selected,
        lamp: 'on',
        title: callTitle(call),
        meta: entry?.pending
          ? `denúncia: ${REASON_LABEL[entry.latest.reason]}`
          : `${count(call.people.length, 'pessoa', 'pessoas')} · até ${hour(call.listedUntil)}`,
        age: `até ${hour(call.listedUntil)}`,
      });
    };
    const selectedCase = selected ? caseOf.get(selected.id) : undefined;
    body = html`<div class="desk">
      ${listPanel({
        id: 'companhia:noar',
        countLine: ordered.length
          ? `${count(ordered.length, 'mesa ou grupo', 'mesas e grupos')} · com denúncia primeiro`
          : 'vazia',
        cuts: true,
        body: ordered.length
          ? html`${withReports.length ? html`${block('Com denúncia aberta', withReports.length, 'ask')}${withReports.map(line)}` : null}${without.length ? html`${withReports.length ? block('Sem denúncia aberta', without.length) : null}${without.map(line)}` : null}`
          : emptyState('task_alt', 'Nada no ar agora'),
      })}
      ${selected ? (selectedCase ? casePreview(selectedCase, ids) : listedPreview(selected, ids)) : emptyPreview('Nada aqui agora')}
    </div>`;
  } else {
    const ids = done.map(entry => entry.callId);
    const selected = pick(done, entry => entry.callId, item);
    body = html`<div class="desk">
      ${listPanel({
        id: 'companhia:feitos',
        countLine: 'últimos 7 dias, o mais novo primeiro',
        cuts: false,
        body: done.length
          ? html`${done.map(entry =>
              row({
                href: href('feitos', entry.callId),
                selected: entry === selected,
                lamp: null,
                title: `${callTitle(entry.latest)} · ${REASON_LABEL[entry.latest.reason]}`,
                meta: decision(entry),
                age: ago(entry.reviewedAt ?? entry.latest.createdAt, now),
              }),
            )}`
          : emptyState('history', 'Nada feito nos últimos 7 dias'),
      })}
      ${selected ? donePreview(selected, ids) : emptyPreview('Nada aqui agora')}
    </div>`;
  }

  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'companhia',
    title: 'Companhia agora',
    summary,
    tabs,
    tab,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}

/* ------------------------------------------------------------- os números */

type StatCounts = DayStats['counts'];
const n = (counts: StatCounts, key: keyof StatCounts) => counts[key] ?? 0;
const sumOf = (counts: StatCounts, prefix: string) =>
  Object.entries(counts)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((total, [, value]) => total + (value ?? 0), 0);

/** A procura, o funil e as horas: só contagens, sem quem nem recado. */
function statsView(stats: DayStats[]) {
  if (!stats.length)
    return html`<div class="nums">
      <section class="panel wide">
        ${emptyState('monitoring', 'Ainda não há números', undefined, 'Eles começam no primeiro uso.')}
      </section>
    </div>`;
  const days = [...stats].reverse();
  const lookers = (day: DayStats) => sumOf(day.counts, 'lookers_h');
  const empty = (day: DayStats) => sumOf(day.counts, 'empty_h');
  const total = (key: keyof StatCounts) =>
    stats.reduce((sum, day) => sum + n(day.counts, key), 0);
  const opened = total('opened_lunch') + total('opened_home');
  const filled = total('filled_lunch') + total('filled_home');
  const arrived = total('arrived_lunch') + total('arrived_home');
  const latest = stats[0];
  const hours = Array.from({ length: 24 }, (_, at) => ({
    at,
    lookers: n(latest.counts, `lookers_h${at}`),
    empty: n(latest.counts, `empty_h${at}`),
  })).filter(entry => entry.lookers > 0);
  const hourMax = Math.max(1, ...hours.map(entry => entry.lookers));
  const bar = (value: number) =>
    trusted(
      `style="width:${opened ? ((value * 100) / opened).toFixed(1) : '0'}%"`,
    );
  const lg = legend(
    html`<abbr
      title="Alunos que abriram a lista e acharam mesa ou grupo, contados uma vez a cada 15 minutos"
      >acharam alguém</abbr
    >`,
    html`<abbr
      title="Os que não acharam nenhuma mesa nem grupo: as horas que pedem um convite"
      >acharam vazia</abbr
    >`,
  );
  return html`<div class="nums">
    <section class="panel wide" aria-label="Números da Companhia agora">
      <div class="bar">
        <h2>Últimos ${COMPANION_STATS_DAYS} dias</h2>
        <span class="count">só contagens, sem quem nem recado</span>
      </div>
      <div class="np-grid">
        <div class="np">
          <h3>A procura</h3>
          <p class="hint">
            Quem chegou à lista em cada dia. O maior dia teve
            ${Math.max(...days.map(lookers))}.
          </p>
          ${lg}${stackBars(days, {
            label: day => statDay(day.day).split(', ')[1] ?? day.day,
            total: lookers,
            part: empty,
            tip: day =>
              `${statDay(day.day)}: ${lookers(day)} olharam, ${empty(day)} acharam vazia${lookers(day) ? ` (${percent(empty(day), lookers(day))})` : ''}`,
          })}
        </div>
        <div class="np-col">
          <div class="np">
            <h3>Até onde as mesas e os grupos chegam</h3>
            <p class="hint">
              Soma de ${count(stats.length, 'dia com uso', 'dias com uso')}.
            </p>
            <div class="funnel">
              <div>
                <span class="l">Abertos</span
                ><span class="track"><i class="mid" ${bar(opened)}></i></span
                ><span class="v"><b>${opened}</b></span>
              </div>
              <div>
                <span class="l"
                  ><abbr title="Chegaram a duas pessoas ou mais"
                    >Com companhia</abbr
                  ></span
                ><span class="track"><i class="mid" ${bar(filled)}></i></span
                ><span class="v"
                  ><b>${filled}</b
                  ><span class="quiet">${percent(filled, opened)}</span></span
                >
              </div>
              <div>
                <span class="l"
                  ><abbr title="Tiveram um 'Cheguei no ponto'"
                    >Chegaram no ponto</abbr
                  ></span
                ><span class="track"><i class="mid" ${bar(arrived)}></i></span
                ><span class="v"
                  ><b>${arrived}</b
                  ><span class="quiet">${percent(arrived, filled)}</span></span
                >
              </div>
            </div>
          </div>
          <div class="np">
            <h3>Por hora, ${statDay(latest.day)}</h3>
            ${
              hours.length
                ? html`${lg}
                    <div
                      class="hours"
                      ${trusted(`style="--hours:${hours.length}"`)}
                    >
                      ${hours.map(
                        entry =>
                          html`<div
                            title="${entry.at}h: ${entry.lookers} olharam, ${entry.empty} acharam vazia"
                          >
                            <span
                              class="bar-h"
                              ${trusted(`style="height:${((entry.lookers / hourMax) * 100).toFixed(1)}%"`)}
                              ><i
                                ${trusted(`style="height:${((entry.empty / entry.lookers) * 100).toFixed(1)}%"`)}
                              ></i></span
                            ><span>${entry.at}h</span>
                          </div>`,
                      )}
                    </div>`
                : html`<p class="hint">Ninguém olhou a lista ainda.</p>`
            }
            <div class="facts-line">
              <span
                >Saíram do ar
                <b>${total('hidden_reports') + total('hidden_moderation')}</b>
                <span class="quiet"
                  >(${total('hidden_reports')} pelas denúncias,
                  ${total('hidden_moderation')} por você)</span
                ></span
              >
              <span
                ><abbr
                  title="Aberturas recusadas porque o campus já tinha o máximo de mesas"
                  >Recusadas pelo teto</abbr
                >
                <b>${total('busy')}</b></span
              >
              <span>Cheguei em casa <b>${total('phrase_home_safe')}</b></span>
              <span
                >Denúncias
                <b
                  >${total('reports_member') + total('reports_host') + total('reports_outsider')}</b
                >
                <span class="quiet"
                  >(${total('reports_outsider')} de fora)</span
                ></span
              >
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

export const companionHref = (base: string) => areaHref(base, 'companhia');
