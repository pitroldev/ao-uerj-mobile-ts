// Synthetic examples: never copy authenticated pages or credentials here.
export const loginPage = `
  <form method="post" action="/requisicaoaluno/">
    <input name="requisicao" value="synthetic-login-requisition">
    <input name="_token" value="synthetic-csrf-token">
    <input name="matricula">
    <input name="senha" type="password">
  </form>
`;

export const studentHeader = `
  <div id="divCabecalhoAplicacao">
    <font>Aluno - Estudante de Teste</font>
    <font>2026/2</font>
  </div>
`;

export const homePage = `
  ${studentHeader}
  <div id="menu_linha_item">
    <a onclick="enviar('synthetic_grades_requisition_1234')">Notas do Período</a>
    <a onclick="enviar('synthetic_courses_requisition_1234')">Disciplinas do Currículo</a>
  </div>
`;

export const rejectedLoginPage = `
  ${loginPage}
  <br><table><tr><td><font>Matrícula ou senha inválida.</font></td></tr></table>
`;

export const blockedHomePage = `
  ${studentHeader}
  <div id="menu_linha_item">
    ${Array.from(
      { length: 21 },
      () => '<a onclick="alert(\'Bloqueado\')">Recurso indisponível</a>',
    ).join('')}
  </div>
`;
