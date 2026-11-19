import type {
  Diagnostic,
  ErrorReport,
} from '../../../../../modules/reports/domain.ts';
import { count, stamp } from './format.ts';
import { html } from './html.ts';
import { generatorSummary, portalErrorsSummary } from './labels.ts';
import { icon } from './pieces.ts';
import {
  areaHref,
  bareDocument,
  logo,
  shell,
  type SideCounts,
} from './shell.ts';

/* As páginas avulsas da administração: entrar, os avisos e o diagnóstico. */

export { generatorSummary } from './labels.ts';

/**
 * A única página que qualquer um vê: não diz o que há atrás dela, onde fica o
 * token nem como ele é feito. Depois de um erro, diz quantas tentativas
 * restam na janela (o limite já manda isso nos cabeçalhos).
 */
export function loginPage({
  base,
  notice,
  remaining,
}: {
  base: string;
  notice: 'failed' | 'limited' | null;
  remaining?: number;
}) {
  const message =
    notice === 'failed'
      ? `Token inválido.${remaining === undefined ? '' : ` ${remaining === 0 ? 'Acabaram as tentativas' : `Restam ${count(remaining, 'tentativa', 'tentativas')}`} nestes 15 minutos.`}`
      : notice === 'limited'
        ? 'Muitas tentativas. Espere alguns minutos e tente de novo.'
        : null;
  return bareDocument(
    base,
    'Acesso restrito',
    html`<main class="login">
      <form method="post" action="${base}/admin/entrar">
        ${logo}
        <h1>Acesso restrito</h1>
        <div>
          <label for="token">Token</label>
          <div class="pass">
            <input
              class="field"
              id="token"
              name="token"
              type="password"
              autocomplete="current-password"
              required
              autofocus
              spellcheck="false"
              ${message ? html`aria-invalid="true" aria-describedby="token-help"` : null}
            />
            <button
              class="icon-btn no-js-hide"
              type="button"
              id="tok-eye"
              aria-label="Mostrar o token"
            >
              ${icon('visibility', true)}
            </button>
          </div>
          ${message ? html`<p class="field-help err" id="token-help" role="alert">${message}</p>` : null}
        </div>
        <button class="btn key" type="submit">Entrar</button>
      </form>
    </main>`,
  );
}

/** Um aviso no lugar da área (banco fora do ar, página vencida, não encontrado). */
export function messagePage({
  base,
  title,
  text,
  csrf,
  counts = null,
  retry = false,
}: {
  base: string;
  title: string;
  text: string;
  csrf: string | null;
  counts?: SideCounts | null;
  /** O botão de tentar de novo (o banco fora do ar). */
  retry?: boolean;
}) {
  if (!csrf)
    return bareDocument(
      base,
      title,
      html`<main class="login">
        <div>
          <h1>${title}</h1>
          <p class="field-help">${text}</p>
        </div>
      </main>`,
    );
  return shell({
    base,
    csrf,
    counts,
    area: null,
    title,
    body: html`<div class="panel" style="align-self:start">
      <div class="empty">
        ${icon(retry ? 'cloud_off' : 'warning')}<b>${title}</b
        ><span>${text}</span>
        <a class="btn" href="${areaHref(base, 'inicio')}"
          >${icon(retry ? 'sync' : 'home', true)}${retry ? 'Tentar de novo' : 'Voltar ao Início'}</a
        >
      </div>
    </div>`,
  });
}

/** O diagnóstico de um relato, aberto inteiro. */
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
    ['Enviado em', stamp(report.createdAt)],
    ['Versão do app', diagnostic.appVersion],
    [
      'Atualização (OTA)',
      diagnostic.updateId ?? 'nenhuma informada (JS da loja ou app antigo)',
    ],
    ['Leitura do portal', diagnostic.parserVersion],
    ['Tipo', diagnostic.category],
    ['Operação', diagnostic.operation],
  ];
  if (diagnostic.subjectCode) rows.push(['Disciplina', diagnostic.subjectCode]);
  if (diagnostic.eventId) rows.push(['Evento no Sentry', diagnostic.eventId]);
  if (diagnostic.generator)
    rows.push(['Gerador de grade', generatorSummary(diagnostic.generator)]);
  if (diagnostic.portalErrors)
    rows.push([
      'Leituras do portal com erro',
      portalErrorsSummary(diagnostic.portalErrors),
    ]);
  if (diagnostic.pages)
    rows.push([
      'Páginas anonimizadas nos anexos',
      diagnostic.pages.join(' · '),
    ]);
  if (diagnostic.pageErrors)
    rows.push([
      'Páginas que não vieram',
      portalErrorsSummary(diagnostic.pageErrors),
    ]);
  return shell({
    base,
    csrf,
    counts: null,
    area: 'relatos',
    title: 'Diagnóstico do relato',
    summary: html`<span>o que o app mandou junto, sem dado pessoal</span>`,
    body: html`<div class="panel doc" style="grid-template-rows:auto">
      <div class="doc-in">
        <a class="btn ghost" href="${areaHref(base, 'relatos')}"
          >${icon('arrow_back', true)}Voltar aos relatos</a
        >
        <dl class="sheet">
          ${rows.map(
            ([term, value]) =>
              html`<dt>${term}</dt>
                <dd>${value}</dd>`,
          )}
        </dl>
        <pre class="raw">${pretty}</pre>
      </div>
    </div>`,
  });
}
