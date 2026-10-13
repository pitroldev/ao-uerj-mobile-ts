// Synthetic "Dados da Disciplina" page. Like the portal, the class table has
// no explicit <tbody>: the parser depends on the one the HTML5 parser inserts.
const classBlock = (
  number: number,
  preference: string,
  schedule: string,
  location: string,
  teachers: string,
  vacancies: string[],
) => `
<div>
  <div style="width:58%;float:left;">
    <div style="width:50%;text-align:left;float:left; margin-top: 5px;">Turma: ${number}</div>
    <div style="width:50%;text-align:left;float:left; margin-top: 5px;">Preferencial: ${preference}</div>
    <div style="width:86%;text-align:left;float:left;">${schedule}</div>
    <div style="width:74%;text-align:left;float:left;">${location}</div>
    <div style="width:86%;text-align:left;float:left;">${teachers}</div>
  </div>
  <div style="width:40%;float:left;">
    <table>
      <tr><th>Vagas</th><th>Ofertadas</th><th>Ocupadas</th></tr>
      <tr><td>UERJ</td><td>${vacancies[0]}</td><td>${vacancies[1]}</td></tr>
    </table>
    <table>
      <tr><th>Solicitação</th><th>Vagas</th><th>Pedidos</th><th>Pref.</th></tr>
      <tr><td>Tipo</td><td>-</td><td>-</td><td>-</td></tr>
      <tr><td>UERJ</td><td>${vacancies[2]}</td><td>${vacancies[3]}</td><td>${vacancies[4]}</td></tr>
      <tr><td>Vestibular</td><td>${vacancies[5]}</td><td>${vacancies[6]}</td><td>${vacancies[7]}</td></tr>
    </table>
  </div>
</div>`;

export const subjectPage = `
<div class="divContentBox"><div class="divContentBoxBody"><div>
  <div>Disciplina: ABC01-04827 ÁLGEBRA LINEAR II</div>
  <div>Créditos: 4  Carga Horária Total: 60  Tempos Semanais: 4</div>
  <div>Universal? Não  Conflito? Sim  Preparo? Não</div>
  <div>Tipo de Aprovação: Nota e Frequência</div>
</div></div></div>
<div>
  <div class="divContentBlock"><div class="divContentBlockBody">Ementa</div></div>
  <div class="divContentBlock"><div class="divContentBlockBody"><div>
    <div>Pré-Requisito: ABC01-04826 ÁLGEBRA LINEAR I ou ABC01-04825 GEOMETRIA ANALÍTICA</div>
    <div>Trava: 60 Créditos Obrigatórios</div>
  </div></div></div>
  <div class="divContentBlock"><div class="divContentBlockBody"><table>
    <tr><td>${classBlock(
      1,
      'SIM',
      '<div>SEG</div><div>M1 M2</div><div>QUA</div><div>M1 M2</div>',
      'Pavilhão Central - Sala 6001',
      'PROFESSORA DE TESTE<br>PROFESSOR DA SILVA &amp; SOUZA',
      ['40', '35', '20', '15', '5', '6', '4', '1'],
    )}</td></tr>
    <tr><td>${classBlock(
      2,
      'Não',
      '<div>TER</div><div>T3 T4</div><div>SAB</div><div>M3</div>',
      'Sala 5038 &mdash; Bloco F',
      'DOCENTE DOS SANTOS',
      ['30', '-', '12', '', '0', '7', '2', '9'],
    )}</td></tr>
  </table></div></div>
</div>`;
