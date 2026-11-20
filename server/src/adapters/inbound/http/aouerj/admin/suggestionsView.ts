import {
  AREA_LABEL,
  LABELS,
  PORTAL_LABEL,
  SUGGESTION_TYPE,
  type Idea,
} from '../../../../../modules/ideas/domain.ts';
import type { SimilarIssue } from '../../../../../modules/ideas/ports.ts';
import type { Suggestion } from '../../../../../modules/suggestions/domain.ts';
import { pick, positionOf, tabHref, type PageContext } from './context.ts';
import {
  ideaKey,
  suggestionQueue,
  suggestionsDone,
  type SuggestionItem,
} from './desk.ts';
import { ago, count, dayKey, excerpt, when } from './format.ts';
import { html, type Html } from './html.ts';
import {
  actionButton,
  csrfField,
  emptyPreview,
  emptyState,
  icon,
  listPanel,
  personLink,
  preview,
  row,
} from './pieces.ts';
import { shell } from './shell.ts';

/*
 * Sugestões: as novas e as decididas. As dos apps 1.x são só para ler; as
 * do app 2.x (aluno identificado) a moderação publica como issue no GitHub,
 * junta a um que já existe ou arquiva sem publicar.
 */

export type SuggestionsTab = 'fila' | 'feitos';
export const SUGGESTIONS_TABS: SuggestionsTab[] = ['fila', 'feitos'];

/** O que a prévia de uma sugestão do app precisa além do quadro. */
export type IdeaExtras = {
  /** O GitHub está configurado (o GitHub App no .env). */
  publishing: boolean;
  /** As parecidas no GitHub; `null` se não deu para buscar. */
  similar: SimilarIssue[] | null;
  /** O repositório dos issues ("dono/nome"); `null` sem o GitHub. */
  repository: string | null;
};

const PLATFORM: Record<Idea['platform'], string> = {
  android: 'Android',
  ios: 'iPhone',
};

const ISSUE_STATUS: Record<SimilarIssue['status'], string> = {
  open: 'aberta',
  planned: 'aberta, planejada',
  in_progress: 'aberta, em andamento',
  done: 'feita',
  closed: 'fechada',
};

/** O que decidiram de uma do app, numa frase. */
function decision(idea: Idea) {
  if (idea.status === 'published')
    return idea.issue ? `publicada como #${idea.issue}` : 'publicando…';
  if (idea.status === 'merged') return `juntada à #${idea.issue}`;
  if (idea.status === 'archived') return 'arquivada sem publicar';
  return 'nova';
}

export function suggestionsPage(
  ctx: PageContext,
  {
    tab,
    item,
    extras,
  }: {
    tab: SuggestionsTab;
    item: string | undefined;
    /** Só com uma do app selecionada. */
    extras?: IdeaExtras;
  },
) {
  const { base, desk, now, csrf } = ctx;
  const queue = suggestionQueue(desk);
  const done = suggestionsDone(desk);
  const href = (to: SuggestionsTab, key?: string | null) =>
    tabHref(base, 'sugestoes', to, 'fila', key);
  const list = tab === 'fila' ? queue : done;
  const keys = list.map(entry => entry.key);
  const selected = pick(list, entry => entry.key, item);
  const today = queue.filter(entry => dayKey(entry.at) === dayKey(now)).length;
  const fromApp = queue.filter(entry => entry.kind === 'app').length;

  const tabs = [
    {
      key: 'fila',
      label: 'Novas',
      href: href('fila'),
      n: queue.length,
      ask: true,
    },
    { key: 'feitos', label: 'Decididas', href: href('feitos') },
  ];
  const summary = html`<span>${count(queue.length, 'nova', 'novas')}</span
    >${fromApp ? html`<span>${count(fromApp, 'pelo app', 'pelo app')}</span>` : null}<span
      >${count(today, 'hoje', 'hoje')}</span
    >`;

  /** O que volta junto do formulário: a aba e o próximo da lista. */
  const hiddenFor = (key: string) => {
    const index = keys.indexOf(key);
    const next = keys[index + 1] ?? keys[index - 1] ?? null;
    return html`<input
        type="hidden"
        name="aba"
        value="${tab}"
      />${next ? html`<input type="hidden" name="proximo" value="${next}" />` : null}`;
  };

  const oldPreview = (suggestion: Suggestion) => {
    const hidden = hiddenFor(suggestion.id);
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
      what: suggestion.archivedAt ? 'arquivada' : 'sugestão do app antigo',
      position: positionOf(keys, suggestion.id, key => href(tab, key)),
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

  const ideaPreview = (idea: Idea) => {
    const key = ideaKey(idea.id);
    const hidden = hiddenFor(key);
    const action = (path: string) =>
      `${base}/admin/sugestoes/app/${encodeURIComponent(idea.id)}/${path}`;
    const student = ctx.people.get(idea.studentId);
    const back = href(tab, key);
    const sent = [...desk.ideas.received, ...desk.ideas.decided].filter(
      other => other.studentId === idea.studentId,
    ).length;
    const waiting = idea.status === 'received';
    const publishing = extras?.publishing ?? false;
    const similar = extras?.similar;

    const similarBlock = waiting
      ? html`<h3 class="sec">Parecidas no GitHub</h3>
          ${
            !publishing
              ? html`<p class="quiet">
                  Sem o GitHub configurado no servidor, não dá para buscar.
                </p>`
              : similar === null || similar === undefined
                ? html`<p class="quiet">
                    O GitHub não respondeu agora. Dá para publicar mesmo assim.
                  </p>`
                : similar.length
                  ? html`<ul class="similar">
                      ${similar.map(
                        issue =>
                          html`<li>
                            <a
                              href="${issue.url}"
                              target="_blank"
                              rel="noopener noreferrer"
                              >#${issue.number}
                              ${issue.title.replace(/^\[sugest[ãa]o\]\s*/i, '')}</a
                            >
                            <span class="quiet"
                              >${ISSUE_STATUS[issue.status]},
                              ${count(issue.requests, 'pedido', 'pedidos')}${idea.seenSimilar.includes(issue.number) ? '. O aluno viu e disse que a dele é outra' : ''}</span
                            >
                          </li>`,
                      )}
                    </ul>`
                  : html`<p class="quiet">Nenhuma aberta parecida.</p>`
          }`
      : null;

    const mergeForms =
      waiting && publishing
        ? html`${(similar ?? []).slice(0, 2).map(issue =>
            actionButton({
              action: action('juntar'),
              csrf,
              label: `Juntar à #${issue.number}`,
              iconName: 'groups',
              hidden: html`${hidden}<input
                  type="hidden"
                  name="issue"
                  value="${String(issue.number)}"
                />`,
            }),
          )}`
        : null;

    const dock = waiting
      ? html`${actionButton({
            action: action('arquivar'),
            csrf,
            label: 'Arquivar sem publicar',
            iconName: 'done_all',
            hidden,
          })}${mergeForms}<span class="gap"></span>${
            publishing
              ? html`<span class="hint"
                    >abre o issue do tipo ${SUGGESTION_TYPE}, com
                    "${LABELS.fromApp}" e "${LABELS.area(idea.area)}"</span
                  >${actionButton({
                    action: action('publicar'),
                    csrf,
                    label: 'Publicar no GitHub',
                    iconName: 'public',
                    primary: true,
                    hidden,
                  })}`
              : html`<span class="hint"
                  >falta o GitHub App no .env (GITHUB_APP_ID e
                  GITHUB_APP_PRIVATE_KEY)</span
                >`
          }`
      : html`${idea.issue && extras?.repository ? html`<a class="btn" href="https://github.com/${extras.repository}/issues/${String(idea.issue)}" target="_blank" rel="noopener noreferrer">${icon('open_in_new', true)}Ver a #${idea.issue} no GitHub</a>` : null}<span
            class="gap"
          ></span
          >${
            idea.status === 'archived'
              ? actionButton({
                  action: action('desarquivar'),
                  csrf,
                  label: 'Voltar para as novas',
                  iconName: 'restart_alt',
                  hidden,
                })
              : null
          }`;

    const joinOther =
      waiting && publishing
        ? html`<h3 class="sec">Juntar a outra</h3>
            <form class="ban-row" method="post" action="${action('juntar')}">
              ${csrfField(csrf)}${hidden}<label class="sr" for="juntar-issue"
                >Número do issue</label
              ><input
                class="field"
                id="juntar-issue"
                name="issue"
                inputmode="numeric"
                autocomplete="off"
                placeholder="Número do issue, como 31"
                pattern="#?[0-9]{1,7}"
                required
              /><button class="btn" type="submit">
                ${icon('groups', true)}Juntar
              </button>
            </form>
            <p class="field-help">
              O pedido do aluno vai para o issue aberto, sem abrir outro.
            </p>`
        : null;

    return preview({
      id: '',
      what: waiting ? 'sugestão pelo app' : decision(idea),
      position: positionOf(keys, key, other => href(tab, other)),
      body: html`<h1 class="ttl" style="font-size:22px;max-width:40ch">
          ${idea.title}
        </h1>
        <div class="sub">
          <span class="tag">${AREA_LABEL[idea.area]}</span
          ><span>pelo app ${idea.appVersion}, ${PLATFORM[idea.platform]}</span
          ><span>${when(idea.createdAt, now)}</span
          >${student ? personLink(base, student, back) : null}<span
            class="quiet"
            >${sent > 1 ? `${sent}ª sugestão do aluno em 30 dias` : '1ª sugestão do aluno'}</span
          >${waiting ? null : html`<span class="quiet">${decision(idea)} ${idea.reviewedAt ? when(idea.reviewedAt, now) : ''}</span>`}
        </div>
        <h3 class="sec">Qual problema isso resolve?</h3>
        <p class="pre" style="margin:0;max-width:62ch">${idea.problem}</p>
        <h3 class="sec">Como você imagina?</h3>
        ${idea.idea ? html`<p class="pre" style="margin:0;max-width:62ch">${idea.idea}</p>` : html`<p class="quiet" style="margin:0">Não descreveu.</p>`}
        <h3 class="sec">O Aluno Online já faz isso?</h3>
        <p style="margin:0">${PORTAL_LABEL[idea.portal]}</p>
        ${similarBlock}${joinOther}
        ${waiting ? html`<p class="field-help" style="margin-top:22px">No GitHub vão o título, as respostas, a área e a versão do app. Nome, matrícula e e-mail, não.</p>` : null}`,
      dock,
    });
  };

  const rowOf = (entry: SuggestionItem) =>
    entry.kind === 'old'
      ? row({
          href: href(tab, entry.key),
          selected: entry === selected,
          lamp: null,
          title: excerpt(entry.suggestion.content),
          meta: entry.suggestion.name,
          age: ago(entry.at, now),
        })
      : row({
          href: href(tab, entry.key),
          selected: entry === selected,
          lamp: entry.idea.status === 'received' ? 'ask' : null,
          title: entry.idea.title,
          meta:
            entry.idea.status === 'received'
              ? `pelo app · ${AREA_LABEL[entry.idea.area]}`
              : `${AREA_LABEL[entry.idea.area]} · ${decision(entry.idea)}`,
          age: ago(entry.at, now),
        });

  const body: Html = html`<div class="desk">
    ${listPanel({
      id: `sugestoes:${tab}`,
      countLine: list.length
        ? `${count(list.length, tab === 'fila' ? 'nova' : 'decidida', tab === 'fila' ? 'novas' : 'decididas')} · a mais nova primeiro`
        : 'vazia',
      cuts: false,
      body: list.length
        ? html`${list.map(rowOf)}`
        : tab === 'fila'
          ? emptyState('task_alt', 'Nenhuma sugestão nova', {
              href: href('feitos'),
              label: 'Ver as decididas',
            })
          : emptyState('history', 'Nenhuma sugestão decidida'),
    })}
    ${
      !selected
        ? emptyPreview('Nada aqui agora')
        : selected.kind === 'old'
          ? oldPreview(selected.suggestion)
          : ideaPreview(selected.idea)
    }
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

/** A sugestão selecionada, para a rota buscar o que a prévia precisa. */
export function selectedSuggestion(
  ctx: Pick<PageContext, 'desk'>,
  tab: SuggestionsTab,
  item: string | undefined,
): SuggestionItem | undefined {
  const list =
    tab === 'fila' ? suggestionQueue(ctx.desk) : suggestionsDone(ctx.desk);
  return pick(list, entry => entry.key, item);
}
