import type { Suggestion } from '../../../../../modules/suggestions/domain.ts';
import { pick, positionOf, tabHref, type PageContext } from './context.ts';
import { ago, count, dayKey, excerpt, when } from './format.ts';
import { html, type Html } from './html.ts';
import {
  actionButton,
  emptyPreview,
  emptyState,
  icon,
  listPanel,
  preview,
  row,
} from './pieces.ts';
import { shell } from './shell.ts';

/* Sugestões: as novas e as arquivadas (já lidas). */

export type SuggestionsTab = 'fila' | 'feitos';
export const SUGGESTIONS_TABS: SuggestionsTab[] = ['fila', 'feitos'];

export function suggestionsPage(
  ctx: PageContext,
  { tab, item }: { tab: SuggestionsTab; item: string | undefined },
) {
  const { base, desk, now, csrf } = ctx;
  const { fresh, archived } = desk.suggestions;
  const href = (to: SuggestionsTab, id?: string | null) =>
    tabHref(base, 'sugestoes', to, 'fila', id);
  const list = tab === 'fila' ? fresh : archived;
  const ids = list.map(suggestion => suggestion.id);
  const selected = pick(list, suggestion => suggestion.id, item);
  const today = fresh.filter(
    suggestion => dayKey(suggestion.createdAt) === dayKey(now),
  ).length;

  const tabs = [
    {
      key: 'fila',
      label: 'Novas',
      href: href('fila'),
      n: fresh.length,
      ask: true,
    },
    { key: 'feitos', label: 'Arquivadas', href: href('feitos') },
  ];
  const summary = html`<span>${count(fresh.length, 'nova', 'novas')}</span
    ><span>${count(today, 'hoje', 'hoje')}</span>`;

  const suggestionPreview = (suggestion: Suggestion) => {
    const index = ids.indexOf(suggestion.id);
    const next = ids[index + 1] ?? ids[index - 1] ?? null;
    const hidden = html`<input
        type="hidden"
        name="aba"
        value="${tab}"
      />${next ? html`<input type="hidden" name="proximo" value="${next}" />` : null}`;
    const action = `${base}/admin/sugestoes/${encodeURIComponent(suggestion.id)}/${suggestion.archivedAt ? 'desarquivar' : 'arquivar'}`;
    const dock = html`${suggestion.email ? html`<a class="btn" href="mailto:${suggestion.email}">${icon('mail', true)}Responder por e-mail</a>` : null}<span
        class="gap"
      ></span
      >${
        suggestion.archivedAt
          ? actionButton({
              action,
              csrf,
              label: 'Voltar para as novas',
              iconName: 'restart_alt',
              hidden,
            })
          : actionButton({
              action,
              csrf,
              label: 'Arquivar',
              iconName: 'done_all',
              primary: true,
              hidden,
            })
      }`;
    return preview({
      id: '',
      what: suggestion.archivedAt ? 'arquivada' : 'sugestão',
      position: positionOf(ids, suggestion.id, id => href(tab, id)),
      body: html`<h1 class="ttl" style="font-size:22px;max-width:34ch">
          <span class="pre">${suggestion.content}</span>
        </h1>
        <div class="sub">
          <span>${suggestion.name}</span
          ><span>${when(suggestion.createdAt, now)}</span
          >${suggestion.email ? html`<span>${suggestion.email}</span>` : html`<span class="quiet">sem e-mail para resposta</span>`}${suggestion.archivedAt ? html`<span class="quiet">arquivada ${when(suggestion.archivedAt, now)}</span>` : null}
        </div>`,
      dock,
    });
  };

  const body: Html = html`<div class="desk">
    ${listPanel({
      id: `sugestoes:${tab}`,
      countLine: list.length
        ? `${count(list.length, tab === 'fila' ? 'nova' : 'arquivada', tab === 'fila' ? 'novas' : 'arquivadas')} · a mais nova primeiro`
        : 'vazia',
      cuts: false,
      body: list.length
        ? html`${list.map(suggestion => row({ href: href(tab, suggestion.id), selected: suggestion === selected, lamp: null, title: excerpt(suggestion.content), meta: suggestion.name, age: ago(suggestion.createdAt, now) }))}`
        : tab === 'fila'
          ? emptyState('task_alt', 'Nenhuma sugestão nova', {
              href: href('feitos'),
              label: 'Ver as arquivadas',
            })
          : emptyState('history', 'Nenhuma sugestão arquivada'),
    })}
    ${selected ? suggestionPreview(selected) : emptyPreview('Nada aqui agora')}
  </div>`;
  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'sugestoes',
    title: 'Sugestões',
    summary,
    tabs,
    tab,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}
