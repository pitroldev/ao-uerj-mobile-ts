// Synthetic forms that preserve the observed AO protocol, with no real IDs.
export function documentCatalog({
  generation = 1,
  revision = 'synthetic-document',
  revisions,
  empty = false,
}: {
  generation?: number;
  revision?: string;
  revisions?: string[];
  empty?: boolean;
} = {}) {
  const action = (operation: number, identification: string, option: number) =>
    `enviarRequisicao(formOpcao, ${operation}, 'synthetic_action_${operation}_${generation}', '${identification}', ${option}, 0); return false;`;
  const historyRevisions = revisions ?? [revision];
  const historyRows = historyRevisions
    .map(
      (
        version,
        index,
      ) => `<tr>${index === 0 ? `<td rowspan="${historyRevisions.length}">Histórico Escolar</td>` : ''}<td>${version || ''}</td><td>${version ? '31/12/2030' : ''}</td>
    <td><a href="#" onclick="${action(1, version || '0', 8)}"><img src="generate.png"></a></td>
    <td>${version ? `<a href="#" onclick="${action(2, version, 8)}"><img src="delete.png"></a>` : ''}</td></tr>`,
    )
    .join('');
  return `<form name="formOpcao" method="post" action="">
    <input type="hidden" name="requisicao" value="synthetic-catalog">
    <input type="hidden" name="identificacaoDocumento" value="0">
    <input type="hidden" name="opcao" value="0">
    <input type="hidden" name="subOpcaoDocumento" value="0">
    <input type="hidden" name="_token" value="document-token-${generation}">
    <table><tr><td><table>
      <tr><th>Documento</th><th colspan="2">Opções</th></tr>
      <tr><th>Tipo</th><th>Identificação</th><th>Validade</th><th>Gerar</th><th>Excluir</th></tr>
      ${
        empty
          ? ''
          : `<tr><td>Declaração de Matrícula</td><td></td><td></td>
        <td><a href="#" onclick="${action(1, '0', 5)}"><img src="generate.png"></a></td><td></td></tr>
      ${historyRows}`
      }
    </table></td></tr></table>
  </form>`;
}

export const documentViewer =
  '<iframe src="../tmp/synthetic-document.pdf"></iframe>';
