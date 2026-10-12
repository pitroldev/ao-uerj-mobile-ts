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
pnpm type-check
pnpm test:ci
pnpm test:tooling
```

Os scripts Gradle funcionam no Windows, Linux e macOS. Debug não exige assinatura de publicação. `pnpm build` e `pnpm bundle` exigem `android/keystore.properties` com `keyAlias`, `keyPassword`, `storeFile` e `storePassword`; `storeFile` é relativo a `android/app` ou um caminho absoluto. Esses segredos ficam fora do Git.

`pnpm type-check` usa o TypeScript 7 nativo (`@typescript/native`). O pacote `typescript` é o alias `@typescript/typescript6`, que mantém a API JS do TypeScript 6 para o typescript-eslint e para o editor. O CI executa instalação congelada, lint, TypeScript, testes e build Android. O workflow iOS é acionado manualmente em macOS. A existência de um workflow não equivale à sua execução: consulte as [evidências da refatoração](docs/refactor-progress.md).

## Arquitetura

Casos de uso dependem de portas. Protocolos, HTML e bibliotecas de fornecedores ficam nos adaptadores; a composição conecta as implementações.

```text
src/app/                         composição, provedores e QueryClient
src/modules/identity/            identidade pública, login, restauração e logout
src/modules/academics/           modelos, regras acadêmicas, consultas e compartilhamento
src/modules/planning/            preparação e geração de grades
src/modules/community/           mensagens e consulta de professores
src/modules/support/             relatórios estruturados e sanitização
src/adapters/outbound/           AO, APIs privadas, armazenamento e recursos nativos
src/pages/ e src/features/       telas e componentes de apresentação
src/shared/                     erros compartilhados
```

O ESLint impede imports de React, SDKs, adaptadores e estado global em domínio/aplicação. As queries acadêmicas usam conta e contexto do portal na chave. Cookies e tokens não participam das chaves. Os componentes não copiam respostas para outro armazenamento de estado.

O coordenador AO centraliza login, token, códigos de requisição e renovação concorrente. Uma consulta expirada permite um único replay; erros transitórios têm repetição limitada nas queries. Parsers diferenciam página vazia reconhecida de estrutura inesperada.

O gerador exige uma ação explícita para enviar a solicitação. Seus detalhes são carregados com concorrência limitada e cancelamento. Mensagens, suporte e geração usam APIs próprias, distintas do portal UERJ.

## Persistência e privacidade

- Credenciais e identificação da conta ficam no Keychain/Keystore por `react-native-keychain`.
- Cookies, token e IDs de requisição são efêmeros e pertencem ao adaptador AO.
- O cache acadêmico persistido em AsyncStorage, sem criptografia, tem dono explícito e validade de sete dias por dado. A interface conserva a última resposta em falhas de atualização.
- O logout invalida resultados tardios, aguarda operações nativas, limpa cookies, credenciais e cache da conta.
- A migração do antigo Redux persistido transfere credenciais para armazenamento seguro e remove a cópia em texto simples. Se a transferência falhar, um novo login pode ser necessário.
- Relatórios de suporte enviam diagnóstico estruturado e descrição sanitizada. Não coletam HTML bruto, senha, cookies ou tokens do portal.
- Mensagens enviam nome do autor, turma, disciplina, período escolhido e texto. O gerador envia dados necessários ao cálculo. Este repositório cliente não comprova políticas de retenção dos servidores.

Quando o AO não informa o semestre, a interface usa “Período atual”. O período do mural é um filtro selecionado pelo usuário; não é uma confirmação do calendário acadêmico oficial.

## Diagnóstico do portal real

Os testes comuns usam dados sintéticos e não acessam contas reais. Para o diagnóstico opcional, defina `AO_MATRICULA` e `AO_PASSWORD` no `.env` local:

```sh
pnpm diagnose:ao
pnpm diagnose:ao --expire-session
```

O script compõe o mesmo adaptador e parsers com transporte e cookies em memória no Node. O segundo comando simula perda de sessão e verifica a recuperação, inclusive de IDs derivados. A saída contém etapas, contagens e códigos de erro, sem credenciais ou HTML. Essa checagem não substitui a jornada no transporte nativo.

## Documentação

- [Plano da refatoração e diagnóstico da base](docs/plano-refatoracao.md)
- [Execução, verificações e limites](docs/refactor-progress.md)
- [Incidente de comunicação com o Aluno Online](docs/aluno-online-session-diagnosis.md)

Alterações no portal podem exigir atualização dos parsers. O app preserva dados já carregados e informa falhas de atualização; use o relatório em “Sobre” para descrever problemas persistentes.
