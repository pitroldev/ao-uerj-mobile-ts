/**
 * Synthetic academic values; structure follows the nested tables in 2026
 * reports. The complementary activity tables (one row per activity, the
 * period left empty on the following rows of the same period, and the
 * summary per activity type with its hour cap) only appear for students with
 * activities on record.
 */
const COMPLEMENTARY_TABLES = `
      <table><tr><th>Período</th><th>Nome</th><th>CH Cumprida</th><th>Descrição</th></tr>
        <tr><td>2023/1</td><td>Participação em cursos de extensão</td><td>30</td><td>Oficina de teste</td></tr>
        <tr><td></td><td>Assistir palestras e aulas inaugurais</td><td>4</td><td></td></tr>
        <tr><td>2024/2</td><td>Participação em cursos de extensão</td><td>40</td><td>Curso de teste</td></tr>
      </table>
      <table><tr><th>Resumo por Tipo de Atividade</th><th>CH Máxima</th><th>CH Cumprida</th><th>CH Excedente</th><th>CH Total</th></tr>
        <tr><td>Participação em cursos de extensão</td><td>60</td><td>60</td><td>10</td><td>70</td></tr>
        <tr><td>Assistir palestras e aulas inaugurais</td><td>20</td><td>4</td><td>0</td><td>4</td></tr>
      </table>`;

export function historyPage(
  rows: string,
  complementary = COMPLEMENTARY_TABLES,
) {
  return `<!doctype html><html><head><title>Aluno Online</title></head><body>
    <div class="divContentBoxBody"><table><tr><td>
      <table><tr><td>Resumo</td><td>Créditos</td></tr>
        <tr><td>Carga horária</td><td>300</td></tr></table>${complementary}
      <table><tr><th>Período</th><th>Disciplina</th><th>Crd.</th><th>CH</th>
        <th>Tipo</th><th>Freq.</th><th>Nota</th><th>Situação</th></tr>${rows}</table>
    </td></tr></table></div>
  </body></html>`;
}

export function historyRow(
  period: string,
  id: string,
  status: string,
  grade: string,
) {
  return `<tr><td>${period}</td><td><a class="LINKNAOSUB"><span>${id}</span> DISCIPLINA DE TESTE II</a></td>
    <td>4</td><td>60</td><td>Obrigatória</td><td>${status === 'Isento' ? '-' : '100%'}</td><td>${grade}</td><td>${status}</td></tr>`;
}
