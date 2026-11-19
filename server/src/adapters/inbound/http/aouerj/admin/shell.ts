import { html, trusted, type Html } from './html.ts';
import type { IconName } from './icons.ts';
import { AO_LOGO_PATHS, AO_LOGO_VIEWBOX } from './logo.ts';
import { csrfField, icon, iconSprite } from './pieces.ts';
import { fontFaces, STYLE } from './style.ts';

/* A moldura de toda página da administração: a barra lateral e a área. */

export type AreaKey =
  | 'inicio'
  | 'companhia'
  | 'agora'
  | 'alunos'
  | 'relatos'
  | 'sugestoes'
  | 'status';

export const AREAS: Record<
  AreaKey,
  { label: string; icon: IconName; path: string }
> = {
  inicio: { label: 'Início', icon: 'home', path: '' },
  companhia: { label: 'Companhia agora', icon: 'groups', path: '/companhia' },
  agora: { label: 'Agora no campus', icon: 'campaign', path: '/agora' },
  alunos: { label: 'Alunos', icon: 'person', path: '/alunos' },
  relatos: { label: 'Relatos', icon: 'bug_report', path: '/relatos' },
  sugestoes: { label: 'Sugestões', icon: 'lightbulb', path: '/sugestoes' },
  status: { label: 'Status', icon: 'monitoring', path: '/status' },
};

/** A barra lateral, em grupos; as teclas 0 a 6 seguem esta ordem. */
const NAV: Array<[string | null, AreaKey[]]> = [
  [null, ['inicio']],
  ['Moderação', ['companhia', 'agora', 'alunos']],
  ['Suporte', ['relatos', 'sugestoes']],
  ['Sistema', ['status']],
];
const ORDER: AreaKey[] = NAV.flatMap(([, keys]) => keys);

/** A tecla (0 a 6) de cada área. */
export const ORDER_OF = (area: AreaKey) => ORDER.indexOf(area);

export const areaHref = (base: string, area: AreaKey) =>
  `${base}/admin${AREAS[area].path}`;

/**
 * O que pede você em cada área, para a barra lateral (`null` sem o banco).
 * `live`: algo denunciado ainda está no ar para os alunos.
 */
export type SideCounts = {
  companion: number;
  companionLive: boolean;
  campus: number;
  campusLive: boolean;
  reports: number;
  suggestions: number;
  /** O portal ou o banco fora do ar. */
  trouble: boolean;
};

/** Uma entrada do "Ir para". `top`: aparece com a busca vazia. */
export type PaletteEntry = {
  group: string;
  label: string;
  meta?: string;
  href: string;
  top?: boolean;
};

/** Uma aba da área. */
export type Tab = {
  key: string;
  label: string;
  href: string;
  n?: number;
  ask?: boolean;
};

/** O aviso de depois de uma ação, com o "Desfazer" quando dá. */
export type Flash = {
  text: string;
  sub?: string;
  error?: boolean;
  undo?: { action: string; label?: string; fields?: Record<string, string> };
};

const logo = html`<svg
  class="logo"
  viewBox="${AO_LOGO_VIEWBOX}"
  role="img"
  aria-label="AO UERJ"
>
  ${AO_LOGO_PATHS.map(d => html`<path d="${d}" />`)}
</svg>`;

/** O começo da página, com o estilo; o resto vem no corpo. */
export function documentHead(base: string, title: string) {
  return html`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0c0e11" />
        <link rel="icon" href="data:," />
        <title>${title} · AO UERJ</title>
        <style>
          ${fontFaces(base)}${STYLE}
        </style>
        <script src="${base}/admin/admin.js" defer></script>
      </head>
    </html>`;
}

function sidebar(
  base: string,
  area: AreaKey | null,
  csrf: string,
  counts: SideCounts | null,
) {
  const right = (key: AreaKey) => {
    if (!counts) return null;
    const pending: Partial<Record<AreaKey, [number, boolean]>> = {
      companhia: [counts.companion, counts.companionLive],
      agora: [counts.campus, counts.campusLive],
      relatos: [counts.reports, false],
      sugestoes: [counts.suggestions, false],
    };
    if (key === 'status')
      return counts.trouble
        ? html`<i class="lamp ask" title="Algo fora do ar"></i>`
        : null;
    const entry = pending[key];
    if (!entry) return null;
    const [n, live] = entry;
    return html`${live ? html`<i class="lamp on" title="Tem denúncia no ar"></i>` : null}${n ? html`<span class="n" title="pedem você">${n}</span>` : null}`;
  };
  return html`<aside class="side" aria-label="Áreas">
    <a
      class="brand"
      href="${base}/admin"
      aria-label="Administração do AO UERJ: Início"
      data-key-brand
      >${logo}<span class="brand-t"
        ><b>Administração</b
        ><span class="prod-pill" title="Este é o servidor de produção"
          >produção</span
        ></span
      ></a
    >
    <button class="go no-js-hide" id="go" type="button" aria-haspopup="dialog">
      ${icon('search', true)}<span>Ir para um item ou um aluno</span
      ><kbd>Ctrl K</kbd>
    </button>
    <nav class="nav" aria-label="Áreas">
      ${NAV.map(
        ([group, keys]) =>
          html`${group ? html`<h2>${group}</h2>` : null}${keys.map(
            key =>
              html`<a
                href="${areaHref(base, key)}"
                data-key="${ORDER.indexOf(key)}"
                ${trusted(area === key ? 'aria-current="page"' : '')}
                title="${AREAS[key].label} (tecla ${ORDER.indexOf(key)})"
                >${icon(AREAS[key].icon)}<span class="lbl"
                  >${AREAS[key].label}</span
                >${right(key)}</a
              >`,
          )}`,
      )}
    </nav>
    <div class="side-foot">
      <div class="tc-row">
        <span class="tc" id="tc" aria-label="Horário de São Paulo"></span>
        <form method="post" action="${base}/admin/sair">
          ${csrfField(csrf)}<button
            class="icon-btn"
            type="submit"
            title="Sair"
            aria-label="Sair"
          >
            ${icon('logout', true)}
          </button>
        </form>
      </div>
      <div class="keys-hint no-js-hide">
        <span><kbd>J</kbd><kbd>K</kbd> andar</span><span><kbd>E</kbd> ação</span
        ><span><kbd>T</kbd> segurar</span
        ><span><kbd>0</kbd>–<kbd>6</kbd> áreas</span>
      </div>
    </div>
  </aside>`;
}

function flashBox(flash: Flash, csrf: string) {
  return html`<div
    class="snack${flash.error ? ' err' : ''}"
    role="status"
    aria-live="polite"
    ${trusted(flash.undo ? '' : 'data-auto')}
  >
    <span>${flash.text}</span
    >${flash.sub ? html`<span class="s">${flash.sub}</span>` : null}${
      flash.undo
        ? html`<form method="post" action="${flash.undo.action}">
            ${csrfField(csrf)}${Object.entries(flash.undo.fields ?? {}).map(([name, value]) => html`<input type="hidden" name="${name}" value="${value}" />`)}<button
              type="submit"
            >
              ${flash.undo.label ?? 'Desfazer'}
            </button>
          </form>`
        : null
    }
  </div>`;
}

/** A página inteira de uma área. */
export function shell({
  base,
  csrf,
  counts,
  area,
  title,
  summary,
  tabs,
  tab,
  body,
  banner,
  flash,
  palette,
}: {
  base: string;
  csrf: string;
  counts: SideCounts | null;
  area: AreaKey | null;
  /** O título da área (e da aba do navegador). */
  title: string;
  /** O resumo ao lado do título. */
  summary?: Html | null;
  tabs?: Tab[];
  tab?: string;
  body: Html;
  banner?: Html | null;
  flash?: Flash | null;
  palette?: PaletteEntry[];
}) {
  const head = documentHead(base, title);
  const side = sidebar(base, area, csrf, counts);
  const iconName = area ? AREAS[area].icon : 'grid_view';
  const tabsHtml = tabs?.length
    ? html`<nav class="tabs" aria-label="${title}">
        ${tabs.map(
          item =>
            html`<a
              href="${item.href}"
              ${trusted(item.key === tab ? 'aria-current="page"' : '')}
              >${item.label}${item.n === undefined ? null : html`<span class="n${item.ask && item.n ? ' ask' : ''}">${item.n}</span>`}</a
            >`,
        )}
      </nav>`
    : null;
  const content = html`<div class="app">
    ${side}
    <main class="main">
      <header class="area-head${tabsHtml ? '' : ' solo'}">
        <div class="ah-top">
          ${icon(iconName)}
          <h1>${title}</h1>
          ${summary ? html`<div class="ah-sum">${summary}</div>` : null}
        </div>
        ${tabsHtml}
      </header>
      <div>${banner ?? null}</div>
      <div class="stage">${body}</div>
    </main>
  </div>`;
  const paletteBox = palette
    ? html`<dialog class="palette" id="palette" aria-label="Ir para">
          <input
            class="field"
            placeholder="Ir para uma área, um item ou um aluno"
            autocomplete="off"
            spellcheck="false"
            aria-label="Ir para"
          />
          <ul role="listbox"></ul>
          <div class="pfoot">
            <span><kbd>↑</kbd> <kbd>↓</kbd> escolher</span
            ><span><kbd>Enter</kbd> abrir</span
            ><span><kbd>Esc</kbd> fechar</span
            ><span>A matrícula se busca em Alunos, fora da URL</span>
          </div>
        </dialog>
        <script type="application/json" id="palette-data">
          ${trusted(paletteJson(palette))}
        </script>`
    : null;
  const snack = flash ? flashBox(flash, csrf) : null;
  return html`${head}
    <body>
      ${content}${paletteBox}${snack}${iconSprite()}
    </body>
  </html>`;
}

/** O JSON do "Ir para" dentro do HTML, sem nada que feche a tag. */
function paletteJson(entries: PaletteEntry[]) {
  return JSON.stringify(entries)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** A página de entrar, sozinha: não diz o que há atrás dela. */
export function bareDocument(base: string, title: string, body: Html) {
  const head = documentHead(base, title);
  return html`${head}
    <body class="login-body">
      ${body}${iconSprite()}
    </body>
  </html>`;
}

export { logo };
