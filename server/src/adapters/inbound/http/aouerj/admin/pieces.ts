import type { Student } from '../../../../../modules/students/domain.ts';
import { count, nameCase } from './format.ts';
import { html, trusted, type Html } from './html.ts';
import { ICON_VIEWBOX, ICONS, type IconName } from './icons.ts';

/* As peças que as áreas da administração dividem. */

/*
 * Os ícones vão num sprite no fim da página: cada `icon()` anota o nome, e a
 * moldura põe só os usados. A página é montada de uma vez (sem await no
 * meio), então a anotação não se mistura com a de outro pedido.
 */
const used = new Set<IconName>();

export function icon(name: IconName, small = false) {
  used.add(name);
  return html`<svg
    class="ic${small ? ' s' : ''}"
    aria-hidden="true"
    focusable="false"
  >
    <use href="#i-${name}" />
  </svg>`;
}

/** O sprite com os ícones usados desde o último, e esquece a lista. */
export function iconSprite() {
  const symbols = [...used]
    .map(
      name =>
        `<symbol id="i-${name}" viewBox="${ICON_VIEWBOX}"><path d="${ICONS[name]}"/></symbol>`,
    )
    .join('');
  used.clear();
  return trusted(
    `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`,
  );
}

/** O campo escondido que todo formulário que grava leva. */
export const csrfField = (csrf: string) =>
  html`<input type="hidden" name="csrf" value="${csrf}" />`;

/** Uma linha da lista: link para a prévia do item. */
export function row({
  href,
  selected,
  lamp,
  title,
  meta,
  age,
  times,
}: {
  href: string;
  selected: boolean;
  /** `on`: no ar para os alunos; `ask`: pede você; `null`: nada. */
  lamp: 'on' | 'ask' | null;
  title: string;
  meta: string;
  age: string;
  /** Quantos (os relatos do grupo). */
  times?: number;
}) {
  const lampTitle =
    lamp === 'on' ? 'No ar para os alunos' : lamp === 'ask' ? 'Pede você' : '';
  return html`<a
    class="row"
    href="${href}"
    aria-current="${selected ? 'true' : 'false'}"
    >${lamp ? html`<i class="lamp ${lamp}" title="${lampTitle}"></i>` : html`<i></i>`}<span
      ><span class="row-t"><span class="t">${title}</span></span
      ><span class="row-m">${meta}</span></span
    ><span class="row-r"
      ><span class="age">${age}</span
      >${times === undefined ? null : html`<span class="times" title="${count(times, 'relato', 'relatos')}">×${times}</span>`}</span
    ></a
  >`;
}

/** O título de um bloco da lista ("No ar, com denúncia · 2"). */
export const block = (
  label: string,
  n: number,
  lamp: 'on' | 'ask' | null = null,
) =>
  html`<div class="blk">
    ${lamp ? html`<i class="lamp ${lamp}"></i>` : null}<span>${label}</span
    ><span class="n">${n}</span><span class="rule"></span>
  </div>`;

/** A lista de uma aba: a contagem em cima, as linhas e os atalhos embaixo. */
export function listPanel({
  id,
  countLine,
  body,
  cuts,
  top,
}: {
  /** O nome da lista, para a rolagem voltar ao mesmo lugar. */
  id: string;
  countLine: string;
  body: Html;
  /** A aba tem corte (segurar T). */
  cuts: boolean;
  /** Algo acima da lista (a busca dos alunos). */
  top?: Html;
}) {
  return html`<section class="panel" aria-label="Lista">
    ${top ?? html`<div class="bar"><span class="count">${countLine}</span></div>`}
    <div class="rundown" id="rundown" data-list="${id}">${body}</div>
    <div class="foot-keys">
      <span><kbd>J</kbd><kbd>K</kbd> andar</span
      ><span><kbd>E</kbd> ação principal</span
      >${cuts ? html`<span>segure <kbd>T</kbd> para cortar</span>` : null}
    </div>
  </section>`;
}

/** Sem nada na lista: o que é e, se houver, para onde ir. */
export const emptyState = (
  iconName: IconName,
  title: string,
  link?: { href: string; label: string },
  text?: string,
) =>
  html`<div class="empty">
    ${icon(iconName)}<b>${title}</b>${text ? html`<span>${text}</span>` : null}${link ? html`<a class="btn ghost" href="${link.href}">${link.label}</a>` : null}
  </div>`;

/** A prévia: a barra (o item e o anterior/próximo), o corpo e a barra de ações. */
export function preview({
  label = 'Prévia',
  id,
  what,
  position,
  body,
  dock,
  dockClass = 'dock',
  aside,
}: {
  label?: string;
  id: string;
  what: string;
  /** "2 de 5" e os links do anterior e do próximo. */
  position?: {
    index: number;
    total: number;
    previous: string | null;
    next: string | null;
  };
  body: Html;
  dock: Html | null;
  dockClass?: string;
  /** O lado direito da barra (o "Voltar para"). */
  aside?: Html | null;
}) {
  const nav = position
    ? html`<span class="nav-s"
        >${position.index + 1} de
        ${position.total}${position.previous ? html`<a class="icon-btn" href="${position.previous}" aria-label="Item anterior (K)">${icon('chevron_left')}</a>` : null}${position.next ? html`<a class="icon-btn" href="${position.next}" aria-label="Próximo item (J)">${icon('chevron_right')}</a>` : null}</span
      >`
    : null;
  return html`<section class="panel" aria-label="Prévia">
    <div class="bar pv-bar">
      <i class="lamp pvw"></i>
      <h2>${label}</h2>
      ${id ? html`<span class="what">${id}</span>` : null}<span class="what"
        >${what}</span
      >${aside ?? nav}
    </div>
    <div class="pv-body"><div class="pv-in">${body}</div></div>
    ${dock ? html`<div class="${dockClass}">${dock}</div>` : html`<div></div>`}
  </section>`;
}

/** A prévia vazia (nada escolhido, nada na lista). */
export const emptyPreview = (title: string, text?: string) =>
  html`<section class="panel" aria-label="Prévia">
    <div class="bar pv-bar">
      <i class="lamp"></i>
      <h2>Prévia</h2>
    </div>
    <div class="pv-body">
      ${emptyState('grid_view', title, undefined, text)}
    </div>
    <div></div>
  </section>`;

/**
 * O botão de cortar: segurar 0,9 s (o que não tem volta, 1,5 s, com "de
 * vez"). Sem o script, ele envia o formulário como um botão qualquer.
 */
export function takeButton({
  label,
  final = false,
  lampOn = true,
  iconName = 'visibility_off',
  disabled = false,
}: {
  label: string;
  final?: boolean;
  lampOn?: boolean;
  iconName?: IconName;
  disabled?: boolean;
}) {
  return html`<button
    class="take${final ? ' final' : ''}"
    type="submit"
    data-hold="${final ? '1500' : '900'}"
    ${trusted(disabled ? 'disabled' : '')}
  >
    ${lampOn ? html`<i class="lamp on"></i>` : icon(iconName, true)}<span
      data-label
      >${label}</span
    ><kbd>T</kbd>
  </button>`;
}

/** O corte com a consequência ao lado, num formulário que grava. */
export function take({
  action,
  csrf,
  why,
  label,
  final = false,
  hidden,
}: {
  action: string;
  csrf: string;
  why: Html | string;
  label: string;
  final?: boolean;
  /** Campos a mais (para onde voltar). */
  hidden?: Html;
}) {
  return html`<form method="post" action="${action}">
    ${csrfField(csrf)}${hidden ?? null}
    <div class="take-wrap">
      <span class="take-why">${why}</span>${takeButton({ label, final })}
    </div>
  </form>`;
}

/** Um botão de ação num formulário que grava (o principal leva o E). */
export function actionButton({
  action,
  csrf,
  label,
  iconName,
  primary = false,
  hidden,
}: {
  action: string;
  csrf: string;
  label: string;
  iconName: IconName;
  primary?: boolean;
  hidden?: Html;
}) {
  return html`<form method="post" action="${action}">
    ${csrfField(csrf)}${hidden ?? null}<button
      class="btn${primary ? ' key' : ''}"
      type="submit"
      ${trusted(primary ? 'data-primary' : '')}
    >
      ${icon(iconName, true)}${label}${primary ? html`<kbd>E</kbd>` : null}
    </button>
  </form>`;
}

/** O aluno: o nome, a matrícula e o link para a página dele. */
export function personLink(base: string, student: Student, back?: string) {
  const href = `${base}/admin/alunos/${encodeURIComponent(student.id)}${back ? `?volta=${encodeURIComponent(back)}` : ''}`;
  return html`<a class="person" href="${href}"
    >${icon('person', true)}${nameCase(student.name)}
    <span class="mat">${student.matricula}</span></a
  >`;
}

/** O quadro "o que os alunos veem": o cartão no visual do app, com a faixa embaixo. */
export function programMonitor({
  liveUntil,
  off = false,
  card,
  caption,
}: {
  /** "até 16:05" no ar; `null` fora. */
  liveUntil: string | null;
  off?: boolean;
  card: Html;
  caption?: string;
}) {
  return html`<div class="pgm${off ? ' off' : ''}${liveUntil ? ' live' : ''}">
      <div class="pgm-screen">${card}</div>
      <div class="umd${liveUntil ? ' live' : ''}">
        <i class="lamp${liveUntil ? ' on' : ''}"></i
        >${liveUntil ? `No ar · ${liveUntil}` : 'Fora do ar'}<span class="r"
          >o que os alunos veem</span
        >
      </div>
    </div>
    ${caption ? html`<p class="pgm-cap">${caption}</p>` : null}`;
}

/** As barras empilhadas de 14 dias: o total escuro e a parte, clara, embaixo. */
export function stackBars<T>(
  rows: readonly T[],
  {
    label,
    total,
    part,
    tip,
  }: {
    label: (row: T) => string;
    total: (row: T) => number;
    part: (row: T) => number;
    tip: (row: T) => string;
  },
) {
  const max = Math.max(1, ...rows.map(total));
  const W = 640;
  const H = 150;
  const pad = 18;
  const gap = 8;
  const width = (W - (rows.length - 1) * gap) / Math.max(1, rows.length);
  const bars = rows.map((item, index) => {
    const x = index * (width + gap);
    const full = (total(item) / max) * (H - pad);
    const low = (Math.min(part(item), total(item)) / max) * (H - pad);
    return `<g class="day"><title>${escapeText(tip(item))}</title><rect class="look" x="${x.toFixed(1)}" y="${(H - pad - full).toFixed(1)}" width="${width.toFixed(1)}" height="${Math.max(0, full - low).toFixed(1)}" rx="2"/><rect class="part" x="${x.toFixed(1)}" y="${(H - pad - low).toFixed(1)}" width="${width.toFixed(1)}" height="${low.toFixed(1)}" rx="2"/><text x="${(x + width / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${escapeText(label(item))}</text></g>`;
  });
  const grid = [0.5, 1]
    .map(f => {
      const y = (H - pad - f * (H - pad)).toFixed(1);
      return `<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`;
    })
    .join('');
  return trusted(
    `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Por dia">${grid}${bars.join('')}</svg>`,
  );
}

/** As duas cores dos gráficos, com o que cada uma conta. */
export const legend = (dark: Html | string, light: Html | string) =>
  html`<div class="legend">
    <span><i class="dark"></i>${dark}</span
    ><span><i class="light"></i>${light}</span>
  </div>`;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
const escapeText = (text: string) =>
  text.replace(/[&<>"]/g, char => ESCAPES[char]);

/** As barras horizontais na mesma escala: o rótulo, a barra e o total. */
export function horizontalBars(
  rows: ReadonlyArray<{
    label: string;
    total: number;
    part?: number;
    note?: string;
  }>,
) {
  const max = Math.max(1, ...rows.map(item => item.total));
  return html`<div class="mult">
    ${rows.map(item => {
      const part = item.part ?? 0;
      return html`<div>
        <span class="l" title="${item.label}">${item.label}</span
        ><span
          class="track"
          title="${count(item.total, 'no total', 'no total')}"
          ><i
            ${trusted(`style="width:${(((item.total - part) / max) * 100).toFixed(1)}%"`)}
          ></i
          ><i
            class="light"
            ${trusted(`style="width:${((part / max) * 100).toFixed(1)}%"`)}
          ></i></span
        ><span class="t">${item.total}</span
        ><span class="h">${item.note ?? ''}</span>
      </div>`;
    })}
  </div>`;
}
