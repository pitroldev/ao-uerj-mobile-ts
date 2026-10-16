/** Synthetic academic values; structure follows the nested tables in 2026 reports. */
export function historyPage(rows: string) {
  return `<!doctype html><html><head><title>Aluno Online</title></head><body>
    <div class="divContentBoxBody"><table><tr><td>
      <table><tr><td>Resumo</td><td>Créditos</td></tr>
        <tr><td>Carga horária</td><td>300</td></tr></table>
      <table><tr><th>Período</th><th>Nome</th><th>CH Cumprida</th><th>Descrição</th></tr>
        <tr><td>2023/1</td><td>Atividade complementar</td><td>30</td><td>Participação</td></tr>
      </table>
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
