# Registro de falhas (Sentry)

O app tem o [Sentry](https://sentry.io) integrado para que quebras de parser e erros de tela apareçam sem depender de relato. A configuração fica em `src/app/observability/`.

> [!IMPORTANT]
> Hoje o envio está **desligado**. O SDK só é iniciado em builds de release e com o DSN de `src/app/observability/config.ts` preenchido. O DSN é vazio por padrão, e nesse caso nada é enviado. Antes de preenchê-lo, o responsável precisa cumprir as [pendências](#pendências-antes-de-ligar), inclusive mudar a [política de privacidade](privacidade.md).

## O que é enviado

- tipo, mensagem e pilha do erro, simbolizada pelos source maps do build;
- versão do app, modelo e sistema do aparelho;
- sessões, para a taxa de uso sem falhas por versão;
- rastros com o nome das telas visitadas e o ciclo de vida do app;
- um identificador aleatório da instalação, criado pelo SDK, que conta quantas instalações uma falha atinge.

Casos especiais:

- **Mudança no portal:** `AppError('PORTAL_LAYOUT_CHANGED')` vai como erro tratado, agrupado pela operação (`grades`, `login`…), uma vez por operação a cada abertura do app. Erros de query que não são `AppError` (defeitos do app) também vão, rotulados só pelo recurso (`academics/grades`).
- **Relato em "Sobre":** gera um feedback no Sentry com mensagem fixa, a tela e a categoria escolhidas, ligado ao último erro enviado. A descrição vai só para o servidor do relato. Com o Sentry ativo, o diagnóstico do relato leva também o id do evento de feedback correspondente.

## O que fica de fora

- **Não é enviado:** matrícula, nome, notas, senha, cookies, tokens, HTML do portal e a descrição do relato. Também ficam de fora URLs com parâmetros, corpo de requisições e IP informado pelo SDK (`sendDefaultPii: false`, sem `setUser`).
- **Não é coletado:** rastros de rede (XHR/fetch), console, toques, capturas de tela, hierarquia de views, tracing, profiling e Session Replay.
- **Descartes no aparelho:** erros esperados não viram evento (rede, portal fora do ar, limite de requisições, sessão expirada, cancelamento, login recusado, entrada inválida). Um filtro final tira query strings, dados de requisição e rastros fora da lista de qualquer evento, inclusive dos que o SDK nativo mescla.
- **Onde:** organização na região UE (Frankfurt, `de.sentry.io`). O plano gratuito guarda os eventos por 30 dias.

## Source maps e símbolos

- **Android:** o `sentry.gradle` (em `android/app/build.gradle`) envia os source maps do Hermes no `pnpm bundle`/`pnpm build` só quando `SENTRY_AUTH_TOKEN` existe. Sem o token, ou com `SENTRY_DISABLE_AUTO_UPLOAD=true`, o build segue sem envio.
- **iOS:** as fases do Xcode seguem a mesma regra, para os source maps e os dSYM.
- O `sentry-cli` lê `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_URL=https://de.sentry.io/`.
- **No GitHub:** o job `play` usa o secret `SENTRY_AUTH_TOKEN` e as variáveis `SENTRY_ORG` e `SENTRY_PROJECT` do environment `play` (ver [Release](release.md#configuração-no-github)).

O token de envio nunca entra no repositório. O DSN não é segredo (vai dentro do app), mas só aceita eventos.

## Pendências antes de ligar

1. Criar a organização na região UE e um projeto React Native, e colar o DSN em `config.ts`.
2. No projeto, em Settings > Security & Privacy:
   - ativar "Prevent Storing of IP Addresses";
   - manter ligados o Data Scrubber e os scrubbers padrão, e incluir `senha`, `matricula` e `_token` em "Additional Sensitive Fields".
3. Limitar o volume para caber na cota gratuita (5 mil erros por mês): rate limit da chave em Client Keys e Spike Protection.
4. Criar um token de organização para o envio de source maps e configurar `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` no environment `play`.
5. Atualizar a [política de privacidade](privacidade.md), que hoje diz que o app não usa ferramenta de análise, com:
   - registros de falhas e diagnóstico;
   - o Sentry como operador;
   - a região, a retenção e o vínculo do relato.
6. Atualizar o formulário Data safety da Play: registros de falhas, diagnóstico e o ID da instalação ("IDs do dispositivo ou outros"), coletados e não compartilhados.
7. LGPD:
   - definir e registrar a base legal do registro de falhas;
   - formalizar a transferência internacional: conferir se o DPA do Sentry adota as cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024, exigidas desde 23/08/2025) ou firmá-las.
