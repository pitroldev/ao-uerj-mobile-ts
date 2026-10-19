/**
 * Synthetic student; the structure follows "Síntese da Formação" as observed
 * on 18/10/2026: three .divContentBox boxes (registration, synthesis and
 * "Períodos Letivos"), values after bold labels and the requirement and
 * period tables with <th> headers. The period table lays two
 * period/situation pairs per row, with an empty spacer cell between them.
 */
const field = (label: string, value: string) =>
  `<div><b>${label}</b> ${value}</div>`;

const requirementRow = (label: string, done = '', required = '', status = '') =>
  `<tr><td>• ${label}</td><td>${done}</td><td>${required}</td><td>${status}</td></tr>`;

const SYNTHESIS_REQUIREMENTS = [
  requirementRow('Ramificação 10 - Engenharia - Parte Comum (FEN0001)'),
  requirementRow('Grupo de Obrigatórias', '120', '120', 'Concluído'),
  requirementRow('Ramificação 200 - Módulo Profissional Exemplo'),
  requirementRow('Grupo de Obrigatórias', '40', '60', 'Incompleto'),
  requirementRow(
    'Grupo de Eletivas: Disciplinas Restritas',
    '4',
    '16',
    'Incompleto',
  ),
  requirementRow('Eletivas Extra Ramificação'),
  requirementRow(
    'Eletivas Definidas (livre escolha entre as oferecidas para o curso)',
    '0',
    '8',
    'Incompleto',
  ),
  requirementRow(
    'Eletivas Universais (livre escolha entre as oferecidas pela universidade)',
    '4',
    '4',
    'Concluído',
  ),
  requirementRow('Total de Eletivas', '8', '28', 'Incompleto'),
].join('');

/** Pares período/situação, dois por linha, como no portal. */
export function synthesisPeriodRows(pairs: [string, string][]) {
  const rows: string[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const [left, right] = [pairs[i], pairs[i + 1] ?? ['', '']];
    rows.push(
      `<tr><td>${left[0]}</td><td>${left[1]}</td><td></td><td>${right[0]}</td><td>${right[1]}</td></tr>`,
    );
  }
  return rows.join('');
}

export function graduationSynthesisPage({
  periods = synthesisPeriodRows([
    ['2023/1', 'Cursado'],
    ['2023/2', 'Cursado'],
    ['2024/1', 'Trancado Automaticamente'],
    ['2024/2', 'Cursado'],
    ['2025/1', 'Cursado'],
    ['2025/2', 'Cursado'],
    ['2026/1', 'Inscrito'],
  ]),
  requirements = SYNTHESIS_REQUIREMENTS,
  counters = {
    minimum: '10',
    used: '6',
    maximum: '14',
    remaining: '9',
    extra: '1',
  },
}: {
  periods?: string;
  requirements?: string;
  counters?: Record<
    'minimum' | 'used' | 'maximum' | 'remaining' | 'extra',
    string
  >;
} = {}) {
  return `<!doctype html><html><head><title>Aluno Online</title></head><body>
  <div id="divCabecalhoAplicacao"><font>202300000001 - Aluna Exemplo</font><font>Síntese da Formação</font></div>
  <div class="divContentBox">
    <div class="divContentBoxHeader">Dados somente para consulta / Não vale como documento oficial</div>
    <div class="divContentBoxBody"><div>
      ${field('Ingresso:', '2023/1 por Vestibular')}
      ${field('Situação:', 'Ativa')}
    </div></div>
  </div>
  <div class="divContentBox">
    <div class="divContentBoxHeader">Síntese da Formação</div>
    <div class="divContentBoxBody">
      <div>
        ${field('Centro:', 'Centro de Exemplo')}
        ${field('Unidade:', 'Faculdade de Exemplo')}
        ${field('Curso:', 'Engenharia')}
        ${field('Versão Curricular', '2 - Currículo de Exemplo de 2019 (FEX)')}
        ${field('Regime:', 'Crédito')}
        ${field('Coeficiente de Rendimento:', '7.15')}
      </div>
      <div>
        <div>${field('Titulação:', 'Engenheiro')}${field('Situação:', 'INCOMPLETA')}</div>
        <div>
          <table><tbody><tr>
            <td><b>Conclusão (mês/ano):</b> --/----</td>
            <td><b>Período:</b> ----/-</td>
            <td><b>Colação de Grau:</b> --/--/----</td>
          </tr></tbody></table>
          <table>
            <thead><tr><th>Requisitos Curriculares da Titulação</th><th>Cumprido</th><th>A Cumprir</th><th>Situação</th></tr></thead>
            <tbody>
              <tr><td>• Créditos em Disciplinas Obrigatórias</td><td>160</td><td>20</td><td>Incompleto</td></tr>
              <tr><td>• Créditos em Disciplinas Eletivas</td><td>8</td><td>20</td><td>Incompleto</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div></div>
      <div>${field('Habilitação:', 'Engenharia de Exemplo')}${field('Ênfase:', 'Ênfase Exemplo')}</div>
      <div>
        <div><b>Detalhamento dos Requisitos do Currículo</b></div>
        <div><table>
          <thead><tr><th>Requisitos do Currículo</th><th>Cumprido</th><th>Exigido</th><th>Situação</th></tr></thead>
          <tbody>${requirements}</tbody>
        </table></div>
      </div>
      <div><b>Observação:</b> Cumprido / A Cumprir / Exigido - valores em créditos para cursos de regime de crédito e em disciplinas para cursos seriados.</div>
    </div>
  </div>
  <div class="divContentBox">
    <div class="divContentBoxHeader">Períodos Letivos</div>
    <div class="divContentBoxBody"><div>
      ${field('Mínimo de Períodos para Integralização Curricular:', counters.minimum)}
      ${field('Períodos Utilizados/Em Uso para Integralização Curricular:', counters.used)}
      ${field('Máximo de Períodos para Integralização Curricular:', counters.maximum)}
      ${field('Períodos Restantes para Integralização Curricular:', counters.remaining)}
      ${field('Períodos Extras Concedidos para Integralização Curricular:', counters.extra)}
      <div><table>
        <thead><tr><th>Período</th><th>Situação</th><td></td><th>Período</th><th>Situação</th></tr></thead>
        <tbody>${periods}</tbody>
      </table></div>
    </div></div>
  </div>
  </body></html>`;
}
