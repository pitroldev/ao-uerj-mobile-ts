# Emissão de Documentos

Implementação nativa disponível em **Menu → Acadêmico → Emissão de Documentos**.

## Comportamento

- Consulta os tipos e ações disponibilizados pelo Aluno Online para a conta atual. A lista não é fixa: a [orientação oficial da DEPAAC](https://www.depaac.uerj.br/procedimentos-academicos-e-solicitacoes-digitais) informa que a disponibilidade depende da situação do aluno.
- **Emitir PDF** solicita uma via; **Obter PDF** recupera um documento existente. O portal reutiliza a via vigente enquanto ela estiver válida.
- O PDF fica na memória da tela. **Compartilhar PDF** abre o seletor Android para escolher um aplicativo. Cancelar o seletor permite tentar novamente sem outra emissão. A abertura do seletor não comprova envio ou salvamento pelo destinatário.
- **Excluir documento** pede confirmação específica e informa a irreversibilidade. A ação permite emitir uma via com dados atualizados. Antes de excluir, o adaptador consulta a revisão atual e recusa excluir uma versão diferente da selecionada; depois, relê o catálogo para confirmar o resultado.
- Conforme as instruções do portal, emitir uma nova via também pode remover vias vencidas do mesmo tipo. Nenhuma exclusão de documento real foi feita durante o desenvolvimento.
- A lista acompanha os temas claro/escuro. Ações ficam indisponíveis durante uma operação e sem conexão; erros permitem nova consulta.

## Integração

`modules/documents` define o modelo e as portas `DocumentsPort` e `DocumentSharingPort`. A composição liga o adaptador autenticado do Aluno Online e `NativeDocumentSharing`, tanto no desenvolvimento quanto na produção. O app não oferece conta de demonstração nem gera PDFs locais para substituir os documentos do portal.

Protocolo observado no portal em 16/10/2026:

1. Abrir o menu autenticado **Emissão de Documentos** usando a requisição da sessão.
2. Interpretar `formOpcao`, seus campos ocultos e as ações `enviarRequisicao`. O JavaScript do portal não é executado.
3. Consultar novamente o catálogo antes de cada ação e enviar `POST` com `requisicao`, `identificacaoDocumento`, `opcao`, `subOpcaoDocumento` e `_token` no corpo do formulário.
4. Na emissão/reimpressão, interpretar o `iframe` da resposta e baixar o PDF de `/tmp/` na mesma origem oficial e sessão. Validar assinatura `%PDF-`, marcador final `%%EOF`, MIME e limite de 20 MiB, preservando os bytes em base64.

Leituras usam a recuperação de sessão já existente. Solicitações `POST` não são repetidas automaticamente: uma resposta perdida pode ter sido processada pelo portal. O catálogo é atualizado após a tentativa, inclusive em caso de erro. Troca de identidade e cancelamento invalidam resultados pendentes; downloads aguardam qualquer renovação concorrente antes de usar a sessão.

O catálogo usa uma chave de query separada das informações acadêmicas persistidas. PDFs não entram no cache de queries/mutações. Compartilhar cria um arquivo de nome genérico no cache privado Android e concede acesso ao aplicativo escolhido; ele não é removido imediatamente porque o destinatário pode lê-lo após o seletor fechar. A limpeza posterior cabe ao sistema. Credenciais, tokens, identificações e conteúdo dos documentos não são registrados pela funcionalidade.

## Diagnóstico autenticado

Use `AO_MATRICULA` e `AO_PASSWORD` no `.env`, sem adicioná-lo ao Git:

```sh
pnpm diagnose:documents
pnpm diagnose:documents --reprint-existing
```

O primeiro comando apenas consulta o catálogo. A opção extra recupera somente um documento existente com validade futura, recusa mudar para uma emissão nova e nunca exclui documentos. A saída contém somente etapas, contagens, tamanho e MIME; nenhum PDF ou HTML autenticado é salvo.

Em 16/10/2026, o diagnóstico inicial com a conta autorizada encontrou **6 tipos disponíveis** e recuperou um PDF vigente de **47.465 bytes**, com MIME e assinatura válidos. Esse comando confirmou o catálogo e a reimpressão. A validação nativa posterior está registrada abaixo.

## Validação

Testes automatizados cobrem parsing do formulário, destino permitido do PDF, transporte binário, renovação de sessão, concorrência, ausência de repetição de mutações, confirmação de exclusão por releitura, compartilhamento nativo, navegação privada e estados da interface. As respostas controladas dos testes ficam restritas à suíte de testes; o app usa os serviços reais.

```sh
pnpm type-check
pnpm lint
pnpm test:ci
pnpm test:tooling
```

O fluxo `.maestro/10-documentos.yaml` consulta somente o catálogo da sessão real já autenticada por `scripts/dev/login.cjs`, usando `AO_MATRICULA` e `AO_PASSWORD` do `.env`. Não baixa, emite, compartilha nem exclui documentos. Recursos marcados como indisponíveis são ignorados. Não há capturas explícitas na suíte; relatórios de falhas do Maestro devem permanecer locais, pois podem conter dados pessoais. A obtenção e abertura do PDF são validadas separadamente no Android.

O helper `scripts/qa/android-share-receiver` permite verificar a entrega do arquivo a outro aplicativo local sem envio externo.
