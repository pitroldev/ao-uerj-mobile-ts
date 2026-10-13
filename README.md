# AO UERJ

Aplicativo não oficial do Aluno Online da UERJ, em React Native 0.87.1, React 19.2 e TypeScript. Consulta notas, histórico, currículo, disciplinas, RID e horários, além de oferecer progresso acadêmico, geração de grades e mural de mensagens.

[Google Play](https://play.google.com/store/apps/details?id=com.aouerjmobile) · [Licença GPLv3](LICENSE)

## Desenvolvimento

- Node 22.21.1 (`.node-version`); suportados ^22.13.0, ^24.3.0 ou >=26.0.0 (os mesmos do React Native).
- pnpm 12.11.2, definido em `packageManager`; as configurações do pnpm ficam em `pnpm-workspace.yaml`.
- Android: JDK 17, SDK 37, Build Tools 37.0.0 e NDK 27.1.12297006.
- iOS: macOS, Xcode, Ruby/Bundler e CocoaPods. Não é possível compilar iOS no Windows.

Use pnpm 12.11.2 para instalar dependências (pelo Corepack, é preciso Corepack 0.34.5 ou mais novo: `npm install -g corepack@latest`). Se a versão global for diferente, execute `npx --yes pnpm@12.11.2 install --frozen-lockfile`; o campo `packageManager` registra a versão esperada pelo projeto e pelo CI.

```sh
pnpm install --frozen-lockfile
pnpm start
# Em outro terminal, com emulador/dispositivo disponível:
pnpm android
```

Configure `JAVA_HOME` para o JDK 17 e `ANDROID_HOME` para o SDK instalado. O SDK também pode ser indicado em `android/local.properties` (arquivo local, não versionado).

No macOS, depois de instalar as dependências JavaScript, prepare os módulos nativos do iOS antes de executar o aplicativo:

```sh
bundle install
bundle exec pod install --project-directory=ios
pnpm ios
```

```sh
pnpm build:debug
pnpm build:debug -PreactNativeArchitectures=x86_64
pnpm lint
pnpm format:check
pnpm type-check
pnpm knip
pnpm test:ci
pnpm test:tooling
```

Os scripts Gradle funcionam no Windows, Linux e macOS. Debug não exige assinatura de publicação. `pnpm build` e `pnpm bundle` exigem `android/keystore.properties` com `keyAlias`, `keyPassword`, `storeFile` e `storePassword`; `storeFile` é relativo a `android/app` ou um caminho absoluto. As variáveis `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, quando definidas, têm prioridade sobre o arquivo. Esses segredos ficam fora do Git.

`pnpm type-check` usa o TypeScript 7 nativo (`@typescript/native`). O pacote `typescript` é o alias `@typescript/typescript6`, que mantém a API JS do TypeScript 6 para o editor (o `@styled/typescript-styled-plugin` roda no tsserver) e para o peer do commitlint. `pnpm lint` roda o Oxlint (`.oxlintrc.json`), com as regras que usam tipos (`oxlint-tsgolint`, sobre o TypeScript 7), e falha com qualquer aviso. A formatação fica só com o Prettier: `pnpm format:check` confere o repositório e `pnpm format` corrige. O CI (`quality.yml`) executa instalação congelada, lint, formatação, TypeScript, Knip (dependências, arquivos e exports sem uso), testes, build debug e build release (R8) com uma keystore descartável. O workflow iOS é acionado manualmente em macOS.

## Commits, versão e release

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix(android):`, `chore:`…), validados pelo commitlint. O `pnpm install` instala os hooks do lefthook (`lefthook.yml`): Oxlint e Prettier nos arquivos staged, commitlint na mensagem e type-check no push.
- **Versão:** o `package.json` é a fonte única. O Gradle deriva `versionName` (`vX.Y.Z`) e `versionCode` (`MAJOR × 10⁷ + MINOR × 10⁴ + PATCH`). O iOS ainda está em `1.0 (1)` no `project.pbxproj`, fora da automação: o Xcode reescreve esse arquivo e apagaria as marcações do release-please. Sincronize à mão quando o iOS for publicado.
- **Release:** a cada push na `main`, o release-please (`release.yml`) mantém um PR com a próxima versão e o `CHANGELOG.md`. O merge desse PR cria a tag `vX.Y.Z` e o GitHub Release. No mesmo workflow, um job no environment `play` compila o AAB assinado e o envia para o teste interno da Play; a promoção para produção é feita no Play Console. O PR de release é criado com o `GITHUB_TOKEN` e por isso não dispara o CI.
- **Configuração no GitHub:** habilite "Allow GitHub Actions to create and approve pull requests" e crie o environment `play`, com aprovação obrigatória e restrito à `main`, com os secrets:
  - `ANDROID_KEYSTORE_BASE64`: a keystore de upload em base64 (`base64 -w0 upload.keystore`);
  - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`;
  - `PLAY_SERVICE_ACCOUNT_JSON`: JSON de uma conta de serviço do Google Cloud com a API Google Play Android Developer ativa e permissão de release no app (Play Console > Usuários e permissões).
- **Dependências:** o Renovate (`.github/renovate.json5`, exige o app do Renovate no repositório) abre PRs agrupados às segundas de madrugada, só para versões publicadas há 3 dias ou mais. Atualizações do núcleo do React Native esperam aprovação no Dependency Dashboard, porque pedem o [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/). As actions ficam fixadas por SHA.

## Arquitetura

Casos de uso dependem de portas. Protocolos, HTML e bibliotecas de fornecedores ficam nos adaptadores; a composição conecta as implementações.

```text
src/app/                         composição, provedores, QueryClient e splash nativo (splash.ts)
src/app/observability/           registro de falhas no Sentry (desligado sem DSN)
src/modules/identity/            identidade pública, login, restauração e logout
src/modules/academics/           modelos, regras acadêmicas, consultas e compartilhamento
src/modules/planning/            preparação e geração de grades
src/modules/community/           mensagens e consulta de professores
src/modules/support/             relatórios estruturados e sanitização
src/modules/appearance/          tema do app (Sistema, Claro ou Escuro)
src/modules/delivery/            aviso remoto, atualização pela loja e pedido de avaliação
src/adapters/outbound/           AO, APIs privadas, aviso remoto, armazenamento e recursos nativos
src/specs/                       specs do codegen para TurboModules locais (In-App Updates)
src/pages/ e src/features/       telas e componentes de apresentação
src/shared/                      erros compartilhados
```

O Oxlint impede imports de React, SDKs, adaptadores e estado global em domínio/aplicação. As queries acadêmicas usam conta e contexto do portal na chave. Cookies e tokens não participam das chaves. Os componentes não copiam respostas para outro armazenamento de estado.

O coordenador AO centraliza login, token, códigos de requisição e renovação concorrente. Uma consulta expirada permite um único replay; erros transitórios têm repetição limitada nas queries. Parsers diferenciam página vazia reconhecida de estrutura inesperada.

O gerador exige uma ação explícita para enviar a solicitação. Seus detalhes são carregados com concorrência limitada e cancelamento. Mensagens, suporte e geração usam APIs próprias, distintas do portal UERJ.

## Persistência e privacidade

- Credenciais e identificação da conta ficam no Keychain/Keystore por `react-native-keychain`.
- Cookies, token e IDs de requisição são efêmeros e pertencem ao adaptador AO.
- O cache acadêmico persistido em AsyncStorage, sem criptografia, tem dono explícito e validade de sete dias por dado. A interface conserva a última resposta em falhas de atualização.
- O logout invalida resultados tardios, aguarda operações nativas, limpa cookies, credenciais e cache da conta.
- A migração do antigo Redux persistido transfere credenciais para armazenamento seguro e remove a cópia em texto simples. Se a transferência falhar, um novo login pode ser necessário.
- Relatórios de suporte enviam diagnóstico estruturado e descrição sanitizada. Não coletam HTML bruto, senha, cookies ou tokens do portal. Com o Sentry ativo, o diagnóstico leva também o id do evento de feedback correspondente.
- Mensagens enviam nome do autor, turma, disciplina, período escolhido e texto. O gerador envia dados necessários ao cálculo. Este repositório cliente não comprova políticas de retenção dos servidores.
- O aviso remoto (ver [Aviso remoto](#aviso-remoto)) está sempre ligado. Na abertura e ao voltar ao primeiro plano, no máximo a cada 15 minutos e inclusive antes do login, o app baixa `config/app-status.json` deste repositório em `raw.githubusercontent.com`. A requisição não leva dados do aluno, mas o GitHub (Microsoft, nos EUA) vê o IP do aparelho, o horário e o User-Agent. Os links “Saiba mais” dos avisos só abrem hosts permitidos.
- Atualização e avaliação usam as APIs da própria loja (In-App Updates e In-App Review da Play), que passam pelo app da loja no aparelho; o app não envia dados próprios nesses fluxos.
- Tema, última cópia do aviso remoto, avisos dispensados, data do último pedido de atualização e o histórico de uso que decide o pedido de avaliação ficam no AsyncStorage. Valem para o app inteiro e não são apagados no logout.

Quando o AO não informa o semestre, a interface usa “Período atual”. O período do mural é um filtro selecionado pelo usuário; não é uma confirmação do calendário acadêmico oficial.

### Registro de falhas (Sentry)

O app envia falhas ao [Sentry](https://sentry.io) para que quebras de parser e erros de tela apareçam sem depender de relato. A configuração fica em `src/app/observability/`. O SDK só é iniciado em builds de release e com o DSN de `src/app/observability/config.ts` preenchido; o DSN é vazio por padrão, e nesse caso nada é enviado.

- **O que é enviado:**
  - tipo, mensagem e pilha do erro, simbolizada pelos source maps do build;
  - versão do app, modelo e sistema do aparelho;
  - sessões, para a taxa de uso sem falhas por versão;
  - rastros com o nome das telas visitadas e o ciclo de vida do app;
  - um identificador aleatório da instalação, criado pelo SDK, que conta quantas instalações uma falha atinge.
- **Mudança no portal:** `AppError('PORTAL_LAYOUT_CHANGED')` vai como erro tratado, agrupado pela operação (`grades`, `login`…), uma vez por operação a cada abertura do app. Erros de query que não são `AppError` (defeitos do app) também vão, rotulados só pelo recurso (`academics/grades`).
- **Relato em “Sobre”:** gera um feedback no Sentry com mensagem fixa, a tela e a categoria escolhidas, ligado ao último erro enviado. A descrição vai só para o servidor do relato.
- **O que não é enviado:** matrícula, nome, notas, senha, cookies, tokens, HTML do portal e a descrição do relato. Também ficam de fora URLs com parâmetros, corpo de requisições e IP informado pelo SDK (`sendDefaultPii: false`, sem `setUser`).
- **O que não é coletado:** rastros de rede (XHR/fetch), console, toques, capturas de tela, hierarquia de views, tracing, profiling e Session Replay.
- **Descartes no aparelho:** erros esperados não viram evento (rede, portal fora do ar, limite de requisições, sessão expirada, cancelamento, login recusado, entrada inválida). Um filtro final tira query strings, dados de requisição e rastros fora da lista de qualquer evento, inclusive dos que o SDK nativo mescla.
- **Onde:** organização na região UE (Frankfurt, `de.sentry.io`). O plano gratuito guarda os eventos por 30 dias.

Source maps e símbolos: no Android, o `sentry.gradle` (em `android/app/build.gradle`) envia os source maps do Hermes no `pnpm bundle`/`pnpm build` só quando `SENTRY_AUTH_TOKEN` existe; sem o token, ou com `SENTRY_DISABLE_AUTO_UPLOAD=true`, o build segue sem envio. O `sentry-cli` lê `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_URL=https://de.sentry.io/`. No GitHub, o job `play` usa o secret `SENTRY_AUTH_TOKEN` e as variáveis `SENTRY_ORG` e `SENTRY_PROJECT` do environment `play`. No iOS, as fases do Xcode seguem a mesma regra.

Pendências do responsável antes de preencher o DSN:

1. Criar a organização na região UE e um projeto React Native, e colar o DSN em `config.ts`.
2. No projeto, em Settings > Security & Privacy:
   - ativar “Prevent Storing of IP Addresses”;
   - manter ligados o Data Scrubber e os scrubbers padrão, e incluir `senha`, `matricula` e `_token` em “Additional Sensitive Fields”.
3. Limitar o volume para caber na cota gratuita (5 mil erros por mês): rate limit da chave em Client Keys e Spike Protection.
4. Criar um token de organização para o envio de source maps e configurar `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` no environment `play`.
5. Atualizar a política de privacidade com:
   - registros de falhas e diagnóstico;
   - o Sentry como operador;
   - a região, a retenção e o vínculo do relato.
6. Atualizar o formulário Data safety da Play: registros de falhas, diagnóstico e o ID da instalação (“IDs do dispositivo ou outros”), coletados e não compartilhados.
7. LGPD:
   - definir e registrar a base legal do registro de falhas;
   - formalizar a transferência internacional: conferir se o DPA do Sentry adota as cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024, exigidas desde 23/08/2025) ou firmá-las.

## Aviso remoto

O `config/app-status.json` da `main` chega a todos os apps instalados em até 15 minutos, sem release nem revisão da Play. O formato está em `config/app-status.schema.json` e a validação no app em `src/modules/delivery/domain/appStatus.ts`. Um documento inválido é ignorado, e o app segue com a última cópia válida.

- **Avisos:** `notices` aceita até 10 avisos no topo do Início, cada um com `id`, `level` (`info`, `warning` ou `critical`), `title` e `message`. Opcionais: `url` do “Saiba mais”, `until` (data em que o aviso some) e `platforms`. O aluno pode dispensar cada aviso; para mostrá-lo de novo, troque o `id`.
- **Telas desativadas:** `disabledFeatures` marca telas do menu como indisponíveis (`progress`, `schedule-generator`, `message-board`, `subjects-taken`, `curriculum-subjects`, `universal-subjects`, `subject-search` e `teacher-search`).
- **Versão mínima:** abaixo de `minSupportedVersion`, o app fica na tela de bloqueio com “Atualizar”, mesmo sem rede, porque a cópia fica salva. Só suba o valor para uma versão que já esteja em produção na Play com rollout de 100%; antes disso, parte dos usuários fica bloqueada sem ter o que instalar.
- **Endereço fixo:** o URL está embutido em todo binário publicado (`src/adapters/outbound/delivery/remoteAppStatus.ts`). Não renomeie, transfira nem apague a conta `pitroldev` ou este repositório enquanto houver versões com esse endereço em uso.
- **Pendência do responsável:** a busca já está ativa, sem depender do DSN do Sentry. Incluir o GitHub na política de privacidade e na formalização da transferência internacional da LGPD.

## Diagnóstico do portal real

Os testes comuns usam dados sintéticos e não acessam contas reais. Para o diagnóstico opcional, defina `AO_MATRICULA` e `AO_PASSWORD` no `.env` local:

```sh
pnpm diagnose:ao
pnpm diagnose:ao --expire-session
```

O script compõe o mesmo adaptador e parsers com transporte e cookies em memória no Node. O segundo comando simula perda de sessão e verifica a recuperação, inclusive de IDs derivados. A saída contém etapas, contagens e códigos de erro, sem credenciais ou HTML. Essa checagem não substitui a jornada no transporte nativo.

## Documentação

- [Dependências: decisões, status e pendências](docs/dependencias.md)
- [Contexto de produto e design](PRODUCT.md)
- [Design system “Agenda limpa”: tokens e componentes](src/components/ui/README.md)
- [Ferramentas de desenvolvimento: modo demonstração, deep links, capturas e E2E](scripts/dev/README.md)
- [Propostas de design do redesenho visual](docs/design-proposals/BRIEF.md)

Alterações no portal podem exigir atualização dos parsers. O app preserva dados já carregados e informa falhas de atualização; use o relatório em “Sobre” para descrever problemas persistentes.
