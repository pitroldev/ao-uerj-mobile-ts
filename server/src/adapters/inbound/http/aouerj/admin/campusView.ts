import {
  FLAGS_TO_REMOVE,
  isActive,
  type Notice,
} from '../../../../../modules/campus-now/domain.ts';
import type { Moderation } from '../../../../../modules/campus-now/ports.ts';
import { pick, positionOf, tabHref, type PageContext } from './context.ts';
import { decidedAt } from './desk.ts';
import { ago, count, firstName, hour, statDay } from './format.ts';
import { html, type Html } from './html.ts';
import { NOTICE_ICON, noticeTitle, placeText } from './labels.ts';
import { personCard } from './people.ts';
import {
  actionButton,
  block,
  emptyPreview,
  emptyState,
  horizontalBars,
  icon,
  legend,
  listPanel,
  preview,
  programMonitor,
  row,
  stackBars,
  take,
} from './pieces.ts';
import { shell } from './shell.ts';

/* Agora no campus: os avisos denunciados, os que valem, o que já foi feito e os números. */

export type CampusTab = 'fila' | 'noar' | 'feitos' | 'numeros';
export const CAMPUS_TABS: CampusTab[] = ['fila', 'noar', 'feitos', 'numeros'];

const REMOVED: Record<NonNullable<Notice['removedBy']>, string> = {
  flags: 'pelas denúncias',
  moderation: 'por você',
  ban: 'porque quem avisou foi banido',
};

/** O que aconteceu com o aviso, numa frase (o "Feitos"). */
function decision(notice: Notice, now: Date) {
  if (notice.removedBy === 'ban') return 'Saiu do ar: quem avisou foi banido.';
  if (notice.removedAt)
    return notice.reviewedAt && notice.removedBy === 'flags'
      ? 'Saiu do ar pelas denúncias, e você manteve fora.'
      : 'Você tirou do ar. Quem avisou perdeu os pontos.';
  if (notice.reviewedAt)
    return isActive(notice, now)
      ? 'Você manteve no ar: as denúncias não o tiram mais sozinhas.'
      : 'Você manteve no ar.';
  return 'Acabou.';
}

/** Onde o aviso está agora: valendo, fora do ar, acabou. */
function stateText(notice: Notice, now: Date) {
  if (notice.removedAt)
    return `saiu do ar às ${hour(notice.removedAt)}, ${REMOVED[notice.removedBy ?? 'moderation']}`;
  if (notice.endedAt) return `acabou às ${hour(notice.endedAt)}`;
  if (notice.expiresAt <= now) return `venceu às ${hour(notice.expiresAt)}`;
  return `some às ${hour(notice.expiresAt)}`;
}

export function campusPage(
  ctx: PageContext,
  { tab, item }: { tab: CampusTab; item: string | undefined },
) {
  const { base, desk, now, csrf } = ctx;
  const { moderation, asks, done } = desk.campus;
  const href = (to: CampusTab, id?: string | null) =>
    tabHref(base, 'agora', to, 'fila', id);
  const pending = (notice: Notice) => notice.flags > 0 && !notice.reviewedAt;
  const live = [...moderation.live].sort(
    (a, b) =>
      Number(pending(b)) - Number(pending(a)) ||
      a.expiresAt.getTime() - b.expiresAt.getTime(),
  );

  const tabs = [
    {
      key: 'fila',
      label: 'Pedem você',
      href: href('fila'),
      n: asks.length,
      ask: true,
    },
    { key: 'noar', label: 'Valendo agora', href: href('noar'), n: live.length },
    { key: 'feitos', label: 'Feitos', href: href('feitos') },
    { key: 'numeros', label: 'Números', href: href('numeros') },
  ];
  const summary = html`<span class="live"
      ><i class="lamp on"></i
      >${count(live.length, 'aviso valendo', 'avisos valendo')}</span
    >${
      asks.length
        ? html`<span class="ask"
            >${count(asks.length, 'aviso pede você', 'avisos pedem você')}</span
          >`
        : html`<span>nenhum aviso pede você</span>`
    }`;

  const back = (next: string | null, como?: 'manter' | 'voltar' | 'fora') =>
    html`<input
        type="hidden"
        name="aba"
        value="${tab}"
      />${next ? html`<input type="hidden" name="proximo" value="${next}" />` : null}${como ? html`<input type="hidden" name="como" value="${como}" />` : null}`;
  const nextOf = (ids: string[], id: string) => {
    const index = ids.indexOf(id);
    return ids[index + 1] ?? ids[index - 1] ?? null;
  };

  const meta = (notice: Notice) =>
    !isActive(notice, now)
      ? `${placeText(notice.place)} · ${notice.removedBy === 'flags' ? `saiu do ar com ${count(notice.flags, 'denúncia', 'denúncias')}` : stateText(notice, now)}`
      : `${placeText(notice.place)} · ${pending(notice) ? `${count(notice.flags, 'denúncia', 'denúncias')} · ` : ''}some às ${hour(notice.expiresAt)}`;
  const lampOf = (notice: Notice) =>
    isActive(notice, now) ? 'on' : pending(notice) ? 'ask' : null;

  const noticePreview = (notice: Notice, ids: string[]) => {
    const active = isActive(notice, now);
    const reporter = ctx.people.get(notice.reporter);
    const shows =
      notice.flags > 0 ||
      notice.reviewedAt !== null ||
      notice.removedAt !== null;
    const left = html`<h1 class="ttl">${noticeTitle(notice)}</h1>
      <div class="sub">
        <span class="tag"
          >${icon(NOTICE_ICON[notice.kind], true)}${placeText(notice.place)}</span
        ><span>avisado às ${hour(notice.createdAt)}</span
        ><span>${stateText(notice, now)}</span>
      </div>
      <h3 class="sec">O que os alunos responderam</h3>
      <div class="tally">
        <div>
          <b>${notice.confirmations}</b
          ><span
            ><abbr title="Respostas 'Continua' ao 'ainda está lá?'"
              >Continua</abbr
            ></span
          >
        </div>
        <div>
          <b>${notice.ends}</b
          ><span><abbr title="Respostas 'Acabou'">Acabou</abbr></span>
        </div>
        <div>
          <b>${notice.views.toLocaleString('pt-BR')}</b
          ><span
            ><abbr title="Alunos que viram o aviso na lista">Viram</abbr></span
          >
        </div>
        <div><b>${notice.thanks}</b><span>Valeu</span></div>
        <div class="${notice.flags ? 'flag' : ''}">
          <b>${notice.flags}</b
          ><span
            ><abbr title="Denúncias 'Não é verdade', de alunos diferentes"
              >Não é verdade</abbr
            ></span
          >
        </div>
      </div>
      <div class="rule-line">
        <span class="dots"
          >${Array.from({ length: FLAGS_TO_REMOVE }, (_, index) => html`<i class="${index < notice.flags ? 'f' : ''}"></i>`)}</span
        >${
          notice.reviewedAt
            ? `Você decidiu às ${hour(notice.reviewedAt)}: as denúncias não mudam mais nada.`
            : notice.removedBy === 'flags'
              ? `Com ${FLAGS_TO_REMOVE} "Não é verdade", saiu do ar sozinho. Quem avisou perdeu os pontos até você decidir.`
              : active
                ? `Com ${FLAGS_TO_REMOVE} "Não é verdade", sai do ar sozinho. ${FLAGS_TO_REMOVE - notice.flags === 1 ? 'Falta 1.' : `Faltam ${FLAGS_TO_REMOVE - notice.flags}.`}`
                : 'Já não está no ar.'
        }
      </div>
      <h3 class="sec">Quem avisou</h3>
      ${
        shows
          ? personCard({
              base,
              student: reporter,
              facts: ctx.facts,
              now,
              role: `nível ${notice.level}`,
              back: href(tab, notice.id),
              missing: 'aluno não encontrado',
            })
          : html`<p class="private">
              ${icon('lock', true)}Sem denúncia, quem avisou fica anônimo aqui
              também.
            </p>`
      }`;
    const right = programMonitor({
      liveUntil: active ? `até ${hour(notice.expiresAt)}` : null,
      off: !active,
      card: html`<div class="app-card">
        <div class="ac-t">
          ${icon(NOTICE_ICON[notice.kind])}${noticeTitle(notice)}
        </div>
        <div class="ac-m">
          ${placeText(notice.place)} · há ${ago(notice.createdAt, now)}
        </div>
        <div class="ac-b">
          <span>Continua ${notice.confirmations}</span
          ><span>Valeu ${notice.thanks}</span>
        </div>
      </div>`,
      caption: active
        ? 'Os alunos não veem quem avisou.'
        : 'Os alunos não veem mais esse aviso.',
    });
    const next = nextOf(ids, notice.id);
    const action = (path: 'tirar' | 'voltar') =>
      `${base}/admin/agora/${encodeURIComponent(notice.id)}/${path}`;
    const loses =
      shows && reporter
        ? `${firstName(reporter.name)} perde`
        : 'quem avisou perde';
    const cut = take({
      action: action('tirar'),
      csrf,
      why: `Some agora, e ${loses} os pontos. Dá para voltar.`,
      label: 'Segure para tirar do ar',
      hidden: back(next),
    });
    let dock: Html;
    if (notice.removedBy === 'ban')
      dock = html`<span class="hint"
        >Saiu do ar: quem avisou foi banido.</span
      >`;
    else if (notice.removedAt && pending(notice))
      dock = html`${actionButton({ action: action('tirar'), csrf, label: 'Manter fora do ar', iconName: 'done_all', primary: true, hidden: back(next, 'fora') })}<span
          class="hint"
          >as denúncias estavam certas</span
        ><span class="gap"></span
        ><span class="hint">devolve os pontos</span
        >${actionButton({ action: action('voltar'), csrf, label: 'Voltar ao ar', iconName: 'visibility', hidden: back(next, 'voltar') })}`;
    else if (notice.removedAt)
      dock = html`<span class="hint">fora do ar</span
        ><span class="gap"></span
        >${actionButton({ action: action('voltar'), csrf, label: 'Voltar ao ar', iconName: 'visibility', hidden: back(next, 'voltar') })}`;
    else if (active && pending(notice))
      dock = html`${actionButton({ action: action('voltar'), csrf, label: 'Manter no ar', iconName: 'check_circle', primary: true, hidden: back(next, 'manter') })}<span
          class="hint"
          >as denúncias param de contar</span
        ><span class="gap"></span>${cut}`;
    else if (active)
      dock = html`<span class="hint"
          >${notice.reviewedAt ? 'mantido no ar por você' : 'sem denúncia'}</span
        ><span class="gap"></span>${cut}`;
    else
      dock = html`<span class="hint">Já acabou: não há o que decidir.</span>`;
    return preview({
      id: '',
      what: active
        ? pending(notice)
          ? 'no ar, denunciado'
          : 'no ar'
        : notice.removedAt
          ? 'fora do ar'
          : 'acabou',
      position: positionOf(ids, notice.id, id => href(tab, id)),
      body: html`<div class="pv-grid">
        <div>${left}</div>
        <div>${right}</div>
      </div>`,
      dock,
    });
  };

  const donePreview = (notice: Notice, ids: string[]) =>
    preview({
      id: '',
      what: 'feito',
      position: positionOf(ids, notice.id, id => href(tab, id)),
      body: html`<h1 class="ttl">${noticeTitle(notice)}</h1>
        <div class="sub">
          <span class="tag"
            >${icon(NOTICE_ICON[notice.kind], true)}${placeText(notice.place)}</span
          ><span>avisado às ${hour(notice.createdAt)}</span
          ><span>${count(notice.flags, 'denúncia', 'denúncias')}</span>
        </div>
        <p class="lede">${decision(notice, now)}</p>`,
      dock:
        notice.removedAt && notice.removedBy !== 'ban'
          ? html`<span class="gap"></span
              ><span class="hint">devolve os pontos</span
              >${actionButton({ action: `${base}/admin/agora/${encodeURIComponent(notice.id)}/voltar`, csrf, label: 'Voltar ao ar', iconName: 'visibility', hidden: back(null, 'voltar') })}`
          : html`<span class="gap"></span
              ><span class="hint">Não há o que desfazer.</span>`,
    });

  let body: Html;
  if (tab === 'numeros') body = numbersView(moderation);
  else if (tab === 'fila') {
    const ids = asks.map(notice => notice.id);
    const selected = pick(asks, notice => notice.id, item);
    const onAir = asks.filter(notice => isActive(notice, now));
    const off = asks.filter(notice => !isActive(notice, now));
    const line = (notice: Notice) =>
      row({
        href: href('fila', notice.id),
        selected: notice === selected,
        lamp: lampOf(notice),
        title: noticeTitle(notice),
        meta: meta(notice),
        age: ago(notice.createdAt, now),
      });
    body = html`<div class="desk">
      ${listPanel({
        id: 'agora:fila',
        countLine: asks.length
          ? `${count(asks.length, 'aviso', 'avisos')} · o que está no ar primeiro`
          : 'vazia',
        cuts: true,
        body: asks.length
          ? html`${onAir.length ? html`${block('No ar, com denúncia', onAir.length, 'on')}${onAir.map(line)}` : null}${off.length ? html`${block('Saiu do ar sozinho: confira', off.length, 'ask')}${off.map(line)}` : null}`
          : emptyState('task_alt', 'Nenhum aviso pede você', {
              href: href('noar'),
              label: 'Ver os avisos valendo',
            }),
      })}
      ${selected ? noticePreview(selected, ids) : emptyPreview('Nada aqui agora')}
    </div>`;
  } else if (tab === 'noar') {
    const ids = live.map(notice => notice.id);
    const selected = pick(live, notice => notice.id, item);
    const flagged = live.filter(pending);
    const clean = live.filter(notice => !pending(notice));
    const line = (notice: Notice) =>
      row({
        href: href('noar', notice.id),
        selected: notice === selected,
        lamp: 'on',
        title: noticeTitle(notice),
        meta: meta(notice),
        age: ago(notice.createdAt, now),
      });
    body = html`<div class="desk">
      ${listPanel({
        id: 'agora:noar',
        countLine: live.length
          ? `${count(live.length, 'aviso', 'avisos')} · com denúncia primeiro`
          : 'vazia',
        cuts: true,
        body: live.length
          ? html`${flagged.length ? html`${block('Com denúncia', flagged.length, 'ask')}${flagged.map(line)}` : null}${clean.length ? html`${flagged.length ? block('Sem denúncia', clean.length) : null}${clean.map(line)}` : null}`
          : emptyState('task_alt', 'Nenhum aviso valendo agora'),
      })}
      ${selected ? noticePreview(selected, ids) : emptyPreview('Nada aqui agora')}
    </div>`;
  } else {
    const ids = done.map(notice => notice.id);
    const selected = pick(done, notice => notice.id, item);
    body = html`<div class="desk">
      ${listPanel({
        id: 'agora:feitos',
        countLine: 'últimos 7 dias, o mais novo primeiro',
        cuts: false,
        body: done.length
          ? html`${done.map(notice => row({ href: href('feitos', notice.id), selected: notice === selected, lamp: null, title: `${noticeTitle(notice)} · ${placeText(notice.place)}`, meta: decision(notice, now), age: ago(decidedAt(notice), now) }))}`
          : emptyState('history', 'Nada feito nos últimos 7 dias'),
      })}
      ${selected ? donePreview(selected, ids) : emptyPreview('Nada aqui agora')}
    </div>`;
  }

  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'agora',
    title: 'Agora no campus',
    summary,
    tabs,
    tab,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}

/** Os avisos por dia, onde mais avisam e o que os alunos fizeram na semana. */
function numbersView(moderation: Moderation) {
  const { days, places, week } = moderation;
  const total = days.reduce((sum, day) => sum + day.notices, 0);
  const removed = days.reduce((sum, day) => sum + day.removedByFlags, 0);
  const top = places.slice(0, 5);
  const rest = places.slice(5).reduce((sum, place) => sum + place.notices, 0);
  return html`<div class="nums">
    <section class="panel wide" aria-label="Números do Agora no campus">
      <div class="bar">
        <h2>Últimos ${days.length} dias</h2>
        <span class="count">${count(total, 'aviso', 'avisos')}</span>
      </div>
      <div class="np-grid">
        <div class="np">
          <h3>Avisos por dia</h3>
          <p class="hint">
            O maior dia teve ${Math.max(0, ...days.map(day => day.notices))}.
          </p>
          ${legend('ficaram até acabar', html`<abbr title="Saíram do ar com ${FLAGS_TO_REMOVE} 'Não é verdade'">saíram pelas denúncias</abbr>`)}
          ${stackBars(days, {
            label: day => statDay(day.day).split(', ')[1] ?? day.day,
            total: day => day.notices,
            part: day => day.removedByFlags,
            tip: day =>
              `${statDay(day.day)}: ${count(day.notices, 'aviso', 'avisos')}${day.removedByFlags ? `, ${day.removedByFlags} pelas denúncias` : ''}`,
          })}
        </div>
        <div class="np-col">
          <div class="np">
            <h3>Onde mais avisam</h3>
            <p class="hint">Soma dos ${days.length} dias.</p>
            ${
              top.length
                ? horizontalBars([
                    ...top.map(place => ({
                      label: placeText(place.place),
                      total: place.notices,
                    })),
                    ...(rest ? [{ label: 'Outros lugares', total: rest }] : []),
                  ])
                : html`<p class="hint">Ninguém avisou nada ainda.</p>`
            }
          </div>
          <div class="np">
            <h3>Esta semana</h3>
            <p class="hint">De ${statDay(week.from)} até agora.</p>
            <div class="kv">
              <div>
                <b>${week.answers.toLocaleString('pt-BR')}</b
                ><span
                  ><abbr title="Os 'Continua' e 'Acabou'">respostas</abbr></span
                >
              </div>
              <div>
                <b>${week.views.toLocaleString('pt-BR')}</b><span>viram</span>
              </div>
              <div>
                <b
                  >${week.minutesToEnd === null ? '–' : `${week.minutesToEnd} min`}</b
                ><span
                  ><abbr title="Média, entre os avisos que os alunos encerraram"
                    >até acabar</abbr
                  ></span
                >
              </div>
              <div><b>${removed}</b><span>saíram pelas denúncias</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>`;
}
