/**
 * Synthetic subjects; the structure follows "RID: Resultado da Inscrição" as
 * observed on 18/10/2026: a layout table around a #smallfont table with two
 * header rows, bold section rows between rules and one row per meeting (only
 * the first meeting of a subject has its code), then the branch legend.
 */
const rule = '<tr><td colspan="7"><hr width="100%"></td></tr>';

export function enrollmentSection(title: string) {
  return `${rule}<tr><td colspan="7"><font><b>${title}</b></font></td></tr>${rule}`;
}

export function enrollmentSubject(
  codeAndName: string,
  classNumber: string,
  meetings = 2,
) {
  const meeting = (first: boolean) => `<tr>
    <td align="left">${first ? codeAndName : ''}</td>
    <td align="center">${first ? '4' : ''}</td>
    <td align="center">${first ? '60' : ''}</td>
    <td align="center">${first ? '100' : ''}</td>
    <td align="center">${first ? classNumber : ''}</td>
    <td align="left">SEG</td>
    <td align="left">07:00 - 08:40</td>
  </tr>`;
  return Array.from({ length: meetings }, (_, index) =>
    meeting(index === 0),
  ).join('');
}

export function enrollmentResultPage(rows: string) {
  return `<!doctype html><html><head><title>Aluno Online</title></head><body>
  <table style="margin-left:auto; margin-right:auto"><tbody>
    <tr><td></td></tr>
    <tr style="height:100%"><td style="text-align: center; vertical-align: top;">
      <div style="width:100%">Resultado sujeito a ajustes da coordenação.
        <b>Qualquer alteração posterior consulte Disciplinas em Curso</b></div>
      <br><br>
      <table id="smallfont" width="100%"><tbody>
        <tr><th width="51%"></th><th width="8%"></th><th align="center" width="8%">Carga</th>
          <th width="7%"></th><th width="8%"></th><th width="5%"></th><th width="13%"></th></tr>
        <tr><th align="center">Disciplina</th><th align="center">Créditos</th>
          <th align="center">Horária</th><th align="center">Ramif.</th>
          <th align="center">Turma</th><th align="center"></th><th align="left">Horário</th></tr>
        ${rows}
      </tbody></table>
      <br>
      <table id="smallfont" width="100%"><tbody>
        <tr><th align="left" width="8%">Ramificações</th></tr>
        <tr><td><hr width="100%"></td></tr>
        <tr><td align="left">100 - RAMIFICACAO DE TESTE</td></tr>
      </tbody></table>
    </td></tr>
  </tbody></table>
  </body></html>`;
}
