import type { Notice } from '../../../../../modules/campus-now/domain.ts';
import type { CallReport } from '../../../../../modules/companion/domain.ts';
import type { ErrorReport } from '../../../../../modules/reports/domain.ts';
import {
  isBanned,
  STUDENT_LIMITS,
  type Student,
} from '../../../../../modules/students/domain.ts';
import { positionOf, tabHref, type PageContext } from './context.ts';
import {
  ago,
  count,
  dayMonth,
  hour,
  nameCase,
  stamp,
  when,
  DAY_MS,
} from './format.ts';
import { html, trusted, type Html } from './html.ts';
import { callTitle, noticeTitle, REASON_LABEL } from './labels.ts';
import {
  actionButton,
  csrfField,
  emptyPreview,
  emptyState,
  icon,
  listPanel,
  preview,
  row,
  takeButton,
} from './pieces.ts';
import { areaHref, shell } from './shell.ts';

/* Alunos: os banidos, os que entraram por último, a busca e a página de cada um. */

export type StudentsTab = 'banidos' | 'recentes';
export const STUDENTS_TABS: StudentsTab[] = ['banidos', 'recentes'];

/** O que a moderação junta de um aluno, dos outros módulos (30 dias). */
export type StudentHistory = {
  reports: ErrorReport[];
  notices: Notice[];
  /** As denúncias em que ele estava na chamada. */
  inCalls: CallReport[];
  /** As denúncias que ele fez. */
  made: CallReport[];
};

const BAN_CHOICES: Array<[string, string]> = [
  ['1', '1 dia'],
  ['7', '7 dias'],
  ['30', '30 dias'],
  ['sempre', 'Para sempre'],
];
const BAN_REASONS = [
  'Assédio na Companhia agora',
  'Avisos falsos no campus',
  'Spam no mural',
  'Ofensa no mural',
];

function banLine(student: Student, now: Date) {
  if (!student.ban || !isBanned(student.ban, now)) return null;
  return student.ban.until
    ? `faltam ${Math.max(1, Math.ceil((student.ban.until.getTime() - now.getTime()) / DAY_MS))} d`
    : 'para sempre';
}

export function studentsPage(
  ctx: PageContext,
  {
    tab,
    list,
    student,
    history,
    query,
    found,
    back,
  }: {
    tab: StudentsTab;
    list: Student[];
    student: Student | undefined;
    history: StudentHistory | null;
    /** A matrícula buscada (vazia sem busca) e se achou alguém. */
    query: string;
    found: boolean | null;
    /** Para onde o "Voltar" leva (um caminho da administração). */
    back: string | null;
  },
) {
  const { base, now, csrf } = ctx;
  const href = (to: StudentsTab) => tabHref(base, 'alunos', to, 'banidos');
  const studentHref = (id: string) =>
    `${areaHref(base, 'alunos')}/${encodeURIComponent(id)}${tab === 'banidos' ? '' : `?aba=${tab}`}`;
  const ids = list.map(item => item.id);
  const tabs = [
    {
      key: 'banidos',
      label: 'Banidos',
      href: href('banidos'),
      n: ctx.desk.banned.length,
    },
    { key: 'recentes', label: 'Entraram por último', href: href('recentes') },
  ];
  const summary = html`<span
    >${count(ctx.desk.banned.length, 'banido agora', 'banidos agora')}</span
  >`;

  const search = html`<div class="search-row">
    <form method="post" action="${base}/admin/alunos/busca">
      ${csrfField(csrf)}<label class="sr" for="matricula"
        >Buscar pela matrícula</label
      ><input
        class="field"
        id="matricula"
        name="matricula"
        inputmode="numeric"
        autocomplete="off"
        placeholder="Buscar pela matrícula"
        value="${query}"
      /><button class="btn" type="submit" aria-label="Buscar">
        ${icon('search', true)}
      </button>
    </form>
    ${found === false ? html`<p class="field-help err">Nenhum aluno com essa matrícula entrou no app.</p>` : null}
  </div>`;

  const studentPreview = (person: Student, record: StudentHistory) => {
    const ban = person.ban && isBanned(person.ban, now) ? person.ban : null;
    const since = now.getTime() - 30 * DAY_MS;
    const recentReports = record.reports.filter(
      report => report.createdAt.getTime() >= since,
    );
    const removed = record.notices.filter(
      notice =>
        notice.removedBy === 'flags' || notice.removedBy === 'moderation',
    ).length;
    const calls = new Set(record.inCalls.map(report => report.callId)).size;
    const ledger: Array<[string, number, boolean]> = [
      ['Relatos enviados', recentReports.length, false],
      ['Avisos no campus', record.notices.length, false],
      ['Avisos tirados do ar', removed, removed > 0],
      ['Denúncias recebidas', calls, calls > 2],
      ['Denúncias feitas', record.made.length, false],
      ['Aparelhos', person.devices.length, person.devices.length > 3],
    ];
    const events: Array<[Date, string]> = [
      ...(person.ban
        ? [
            [
              person.ban.at,
              `${isBanned(person.ban, now) ? 'Banido' : 'Foi banido'} ${person.ban.until ? `até ${dayMonth(person.ban.until)}` : 'para sempre'}: ${person.ban.reason}`,
            ] as [Date, string],
          ]
        : []),
      ...record.reports.map((report): [Date, string] => [
        report.createdAt,
        `Mandou um relato de ${report.page}`,
      ]),
      ...record.notices.map((notice): [Date, string] => [
        notice.createdAt,
        `Avisou no campus: ${noticeTitle(notice)}${notice.removedBy === 'flags' ? ' (saiu do ar pelas denúncias)' : notice.removedBy === 'moderation' ? ' (tirado do ar)' : ''}`,
      ]),
      ...record.inCalls.map((report): [Date, string] => [
        report.createdAt,
        `Estava em ${callTitle(report)}, denunciada: ${REASON_LABEL[report.reason]}`,
      ]),
      ...record.made.map((report): [Date, string] => [
        report.createdAt,
        `Denunciou ${callTitle(report)}: ${REASON_LABEL[report.reason]}`,
      ]),
      [person.createdAt, 'Entrou no app pela primeira vez'] as [Date, string],
    ]
      .sort((a, b) => b[0].getTime() - a[0].getTime())
      .slice(0, 15);
    const body = html`<h1 class="ttl">${nameCase(person.name)}</h1>
      <div class="sub">
        <span class="tag"
          >${icon('badge', true)}Matrícula ${person.matricula}</span
        ><span>no app desde ${dayMonth(person.createdAt)}</span
        ><span>visto ${when(person.lastSeenAt, now)}</span
        ><span>${count(person.devices.length, 'aparelho', 'aparelhos')}</span>
      </div>
      ${
        ban
          ? html`<div class="banned-note">
              ${icon('block')}
              <div>
                <p>
                  <b
                    >${ban.until ? `Banido até ${stamp(ban.until)}` : 'Banido para sempre'}.</b
                  >
                  Motivo que ele vê: ${ban.reason}.
                </p>
                <p>
                  Desde ${stamp(ban.at)}. Não usa mural, docentes, relatos,
                  gerador, Companhia nem Agora no campus até o fim do prazo.
                </p>
              </div>
            </div>`
          : null
      }
      <h3 class="sec">No app, 30 dias</h3>
      <div class="ledger">
        ${ledger.map(([label, value, warn]) => html`<div class="${warn ? 'warn' : ''}"><b>${value}</b><span>${label}</span></div>`)}
      </div>
      <h3 class="sec">O que aconteceu</h3>
      <ul class="events">
        ${events.map(([at, text]) => html`<li><time>${when(at, now)}</time><span>${text}</span></li>`)}
      </ul>`;
    const action = `${base}/admin/alunos/${encodeURIComponent(person.id)}`;
    const defaultUntil = new Date(now.getTime() + 7 * DAY_MS);
    const dock: Html = ban
      ? html`<span class="gap"></span
          >${actionButton({ action: `${action}/desbanir`, csrf, label: 'Desbanir', iconName: 'restart_alt' })}`
      : html`<form id="ban-form" method="post" action="${action}/banir">
          ${csrfField(csrf)}
          <div class="ban-row">
            <b>Banir</b>
            <div class="radio" role="radiogroup" aria-label="Por quanto tempo">
              ${BAN_CHOICES.map(([value, label]) => html`<label><input type="radio" name="prazo" value="${value}" ${trusted(value === '7' ? 'checked' : '')} /><span>${label}</span></label>`)}
            </div>
            <label class="sr" for="motivo">Motivo</label
            ><input
              class="field"
              id="motivo"
              name="motivo"
              maxlength="${String(STUDENT_LIMITS.banReason)}"
              required
              placeholder="O motivo, que o aluno vê ao abrir o app"
              autocomplete="off"
            />
          </div>
          <div class="ban-row no-js-hide">
            <div class="reasons">
              ${BAN_REASONS.map(reason => html`<button type="button" data-reason="${reason}">${reason}</button>`)}
            </div>
            <span class="field-help" style="margin:0 0 0 auto"
              >O aluno vê o motivo.</span
            >
          </div>
          <div class="ban-row">
            <p class="consequence">
              <b id="ban-until"
                >Até ${dayMonth(defaultUntil)}, ${hour(defaultUntil)}</b
              >: sai das mesas e grupos da Companhia agora (as que abriu acabam)
              e não usa mural, docentes, relatos, gerador nem Agora no campus.
              Os avisos dele saem do ar. Dá para desbanir.
            </p>
            ${takeButton({ label: 'Segure para banir por 7 dias', lampOn: false, iconName: 'block' })}
          </div>
        </form>`;
    return preview({
      label: 'Aluno',
      id: '',
      what: person.matricula,
      position: back ? undefined : positionOf(ids, person.id, studentHref),
      aside: back
        ? html`<a class="btn ghost back" href="${back}"
            >${icon('arrow_back', true)}Voltar</a
          >`
        : null,
      body,
      dock,
      dockClass: ban ? 'dock' : 'dock stack',
    });
  };

  const body = html`<div class="desk">
    ${listPanel({
      id: `alunos:${tab}`,
      countLine: '',
      cuts: false,
      top: search,
      body: list.length
        ? html`${list.map(item => row({ href: studentHref(item.id), selected: item.id === student?.id, lamp: banLine(item, now) ? 'ask' : null, title: nameCase(item.name), meta: `${item.matricula} · ${item.ban && isBanned(item.ban, now) ? item.ban.reason : count(item.devices.length, 'aparelho', 'aparelhos')}`, age: banLine(item, now) ?? `há ${ago(item.lastSeenAt, now)}` }))}`
        : emptyState(
            'task_alt',
            tab === 'banidos' ? 'Ninguém banido agora' : 'Ninguém entrou ainda',
          ),
    })}
    ${student && history ? studentPreview(student, history) : emptyPreview('Escolha um aluno', 'Ou busque pela matrícula.')}
  </div>`;
  return shell({
    base,
    csrf,
    counts: ctx.counts,
    area: 'alunos',
    title: 'Alunos',
    summary,
    tabs,
    tab,
    body,
    banner: ctx.banner,
    flash: ctx.flash,
    palette: ctx.palette,
  });
}
