# Desenvolvimento

O ambiente em detalhe: versões, scripts, verificações e CI. Se é a sua primeira vez aqui, comece pelo [guia de contribuição](../CONTRIBUTING.md), que tem o passo a passo resumido.

## Versões

| Ferramenta | Versão                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node       | 22.21.1 (`.node-version`); o projeto aceita ^22.13.0, ^24.3.0 ou >=26.0.0 (os mesmos do React Native)                                                           |
| pnpm       | 12.11.2, definido em `packageManager`; as configurações do pnpm ficam em `pnpm-workspace.yaml`                                                                  |
| Corepack   | 0.34.5 ou mais novo, se for usar o pnpm por ele (`npm install -g corepack@latest`)                                                                              |
| Android    | JDK 17, SDK 37 (`compileSdkVersion` 37, `targetSdkVersion` 36, `minSdkVersion` 24), Build Tools 37.0.0 e NDK 27.1.12297006 (o CI instala também o CMake 3.22.1) |
| iOS        | macOS, Xcode, Ruby/Bundler (o CI usa o Ruby 3.3) e CocoaPods. Não é possível compilar iOS no Windows; ver [iOS](ios.md)                                         |
| Servidor   | Node 22.18 ou mais novo, que roda o TypeScript direto; ver [server/README.md](../server/README.md)                                                              |

## Instalação

Use o pnpm 12.11.2 para instalar as dependências. Pelo Corepack, é preciso o Corepack 0.34.5 ou mais novo. Se a versão global for diferente, rode `npx --yes pnpm@12.11.2 install --frozen-lockfile`: o campo `packageManager` registra a versão esperada pelo projeto e pelo CI.

```sh
pnpm install --frozen-lockfile
```

O que essa instalação faz além das dependências do app:

- **Servidor:** o `postinstall` da raiz roda `pnpm --dir server install --ignore-workspace`. O servidor tem dependências e lockfile próprios, fora do workspace do app: nada dele entra no `node_modules` do React Native.
- **Hooks do Git:** o lefthook instala os hooks de `lefthook.yml` (ver [Hooks do Git](#hooks-do-git)).
- **Scripts de instalação:** só rodam os das dependências liberadas em `allowBuilds` do `pnpm-workspace.yaml` (`@parcel/watcher`, `@sentry/cli`, `lefthook` e `unrs-resolver`).
- **`node_modules` plano:** `nodeLinker: hoisted`, porque o Metro, o autolinking do Gradle e o CocoaPods esperam essa estrutura.
- **Correções de terceiros:** o `patchedDependencies` aplica `patches/react-native-share@12.3.1.patch` (no Android, o aviso de "destino escolhido" do compartilhamento nunca chegava), e o `overrides` sobe o `uuid` para a 11.1.1 ou mais nova (GHSA-w5hq-g745-h8pq, vindo do `xcode`, só na geração de assets).

## Android

Configure `JAVA_HOME` para o JDK 17 e `ANDROID_HOME` para o SDK instalado. O SDK também pode ser indicado em `android/local.properties` (arquivo local, não versionado).

```sh
pnpm start
# Em outro terminal, com emulador ou dispositivo disponível:
pnpm android
```

### Scripts do Gradle

Os scripts passam pelo `scripts/gradle.cjs`, que chama o `gradlew.bat` no Windows e o `./gradlew` no Linux e no macOS. Opções do Gradle vão depois do script.

| Script             | Tarefa do Gradle  | Para quê                                         |
| ------------------ | ----------------- | ------------------------------------------------ |
| `pnpm build:debug` | `assembleDebug`   | APK de debug; não exige assinatura de publicação |
| `pnpm build`       | `assembleRelease` | APK de release, assinado                         |
| `pnpm bundle`      | `bundleRelease`   | AAB de release, assinado (o formato da Play)     |
| `pnpm clean`       | `clean`           | Apaga os builds                                  |

`-PreactNativeArchitectures=x86_64` compila só a arquitetura do emulador, bem mais rápido: `pnpm build:debug -PreactNativeArchitectures=x86_64`. O CI usa a mesma opção.

### Assinatura do release

`pnpm build` e `pnpm bundle` exigem `android/keystore.properties` com `keyAlias`, `keyPassword`, `storeFile` e `storePassword`. O `storeFile` é relativo a `android/app` ou um caminho absoluto. As variáveis `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, quando definidas, têm prioridade sobre o arquivo, chave por chave. Esses segredos ficam fora do Git (`keystore.properties`, `*.keystore` e `*.jks` estão no `.gitignore`, menos o `debug.keystore`).

O release também gera os símbolos nativos (`debugSymbolLevel 'SYMBOL_TABLE'`) e, com `SENTRY_AUTH_TOKEN`, envia os source maps ao Sentry (ver [Observabilidade](observabilidade.md#source-maps-e-símbolos)).

A versão do Android vem do `package.json`; ver [Release](release.md#versão).

### Atualizações OTA num build local

O release procura atualizações em `https://pitrol.dev/aouerj/ota/manifest` a cada abertura a frio, e o debug não procura (o JS vem do Metro). Para testar as atualizações no emulador contra um servidor da sua máquina, faça um release de QA apontando para ele:

```sh
pnpm build -PreactNativeArchitectures=x86_64 -PotaUpdateUrl=http://localhost:3000/aouerj/ota/manifest
adb reverse tcp:3000 tcp:3000
```

- **Endereço:** o `-PotaUpdateUrl` troca só o endereço (`android/app/build.gradle`), e o Gradle avisa no log que é um build de QA. Com o `adb reverse`, o `localhost` do emulador é o do computador; sem ele, use `http://10.0.2.2:<porta>`.
- **HTTP:** só com a opção, o release leva a configuração de rede do debug (`src/debug/res/xml/network_security_config.xml`), que libera HTTP para `localhost`, `127.0.0.1`, `10.0.2.2` e `10.0.3.2`. O build normal continua só com HTTPS.
- **Runtime version:** publique para o valor que `node scripts/ota/runtime-version.cjs android` imprime nesta mesma cópia, o que o build embute. Os CR do Windows não contam, então o mesmo commit dá o mesmo valor aqui e no CI; um arquivo nativo alterado ou um certificado trocado (a chave de teste, ver [Atualizações OTA](ota.md#conferir)) dão outro.
- **Nunca publique** um build de QA: ele aceita atualizações de outro servidor. O release da Play sai do CI, sem a opção.

O release sai assinado com a chave de upload (`keystore.properties`). Para instalá-lo por cima do app de debug, sem perder os dados, reassine uma cópia com o `android/app/debug.keystore`.

## iOS

No macOS, depois de instalar as dependências JavaScript, prepare os módulos nativos do iOS antes de executar o app:

```sh
bundle install
bundle exec pod install --project-directory=ios
pnpm ios
```

O estado do iOS, o workflow manual e o que existe só no Android estão em [iOS](ios.md).

## Verificações

| Comando                                        | O que confere                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                    | Oxlint (`.oxlintrc.json`), com as regras que usam tipos (`oxlint-tsgolint`, sobre o TypeScript 7). Falha com qualquer aviso. Inclui as fronteiras da [arquitetura](arquitetura.md#fronteiras-que-o-oxlint-guarda) |
| `pnpm format:check`                            | Prettier no repositório inteiro (a formatação fica só com ele). `pnpm format` corrige                                                                                                                             |
| `pnpm type-check`                              | TypeScript 7 no app, no servidor (`tsc -p server`) e no contrato entre os dois (`tsconfig.contract.json`)                                                                                                         |
| `pnpm knip`                                    | Dependências, arquivos e exports sem uso                                                                                                                                                                          |
| `pnpm test`                                    | Jest, em dois projetos: `unit` (`*.test.ts`, ambiente Node) e `native` (`*.test.tsx`, preset do React Native)                                                                                                     |
| `pnpm test:ci`                                 | O mesmo Jest em série (`--runInBand --ci`), como no CI. Inclui o teste de contrato com o servidor                                                                                                                 |
| `pnpm test:tooling`                            | `node --test` dos scripts (`scripts/__tests__`): Gradle, ferramentas de dev, projeto iOS, endereço da política de privacidade, release, OTA, arquitetura, ícones e mapa                                           |
| `pnpm test:server`                             | Os testes do servidor, com um mongod próprio; ver [server/README.md](../server/README.md#arquitetura)                                                                                                             |
| `pnpm test:deploy`                             | Os scripts de implantação (`deploy/server`), só no Linux                                                                                                                                                          |
| `node scripts/generate-campus-map.cjs --check` | O atlas do mapa offline está em dia com as fontes; ver [scripts/campus-map/README.md](../scripts/campus-map/README.md)                                                                                            |

O CI também roda o `shellcheck deploy/server/*.sh`.

**TypeScript 7 e 6:** `pnpm type-check` usa o TypeScript 7 nativo (`@typescript/native`). O pacote `typescript` é o alias `@typescript/typescript6`, que mantém a API JS do TypeScript 6 para o editor (o `@styled/typescript-styled-plugin` roda no tsserver).

> [!TIP]
> Com pouca memória livre, o `pnpm knip` pode falhar com `RangeError: Array buffer allocation failed`. Rode com `KNIP_DISABLE_RAW_TRANSFER=1`, uma opção do próprio Knip. Isso não é falha do código.

### Hooks do Git

O `pnpm install` instala os hooks do lefthook (`lefthook.yml`):

- **pre-commit:** Oxlint (com `--deny-warnings`) e `prettier --check` nos arquivos staged. Os arquivos ignorados pelas configurações das duas ferramentas são pulados.
- **pre-push:** `pnpm type-check`.

Não há hook de mensagem de commit; a convenção está no [guia de contribuição](../CONTRIBUTING.md#commits).

## CI

| Workflow                                            | Quando roda                                                | O que faz                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Quality](../.github/workflows/quality.yml)         | Todo PR e todo push na `main`                              | Instalação congelada, atlas do mapa, lint, formatação, TypeScript, Knip, testes de tooling, do servidor e do deploy, `shellcheck` e Jest. Em paralelo, build debug e AAB release (R8) com uma keystore descartável, que serve só à validação |
| [Servidor](../.github/workflows/server.yml)         | Push na `main` que mexe no servidor ou no contrato; manual | Confere o servidor e o contrato dele com o app e o implanta na VM, azul/verde; ver [a implantação](../server/README.md#implantação)                                                                                                          |
| [iOS simulator build](../.github/workflows/ios.yml) | Só manual                                                  | Compila o app em Release para o simulador e roda o teste de fumaça; ver [iOS](ios.md#o-workflow-iosyml)                                                                                                                                      |
| [E2E](../.github/workflows/e2e.yml)                 | Só manual, com a opção `run_real_account`                  | Os fluxos do Maestro com uma conta real; ver [scripts/dev/README.md](../scripts/dev/README.md#testes-e2e-maestro)                                                                                                                            |
| [Release](../.github/workflows/release.yml)         | Push na `main`; manual com uma tag                         | Tag dos bumps à mão, PR do release-please e publicação no teste interno da Play; ver [Release](release.md)                                                                                                                                   |
| [OTA](../.github/workflows/ota.yml)                 | Só manual, na `main`                                       | Publica o JavaScript deste commit (ou a volta ao da loja) no servidor, com o Quality verde e o mesmo runtime e versão da última build na loja; ver [Atualizações OTA](ota.md)                                                                |

## Dependências

O Renovate (`.github/renovate.json5`, exige o app do Renovate no repositório) abre PRs agrupados às segundas de madrugada (fuso de São Paulo; correções de segurança ignoram o horário), só para versões publicadas há 3 dias ou mais. As mensagens seguem os prefixos `fix(deps)`/`chore(deps)`, que o release-please reconhece.

- **React Native:** as atualizações do núcleo esperam aprovação no Dependency Dashboard, porque pedem o [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/) (as diferenças de `android/` e `ios/`). As majors do Gradle também esperam aprovação, e o `Gemfile` fica de fora (segue o template do React Native).
- **Actions:** ficam fixadas por SHA, com a versão no comentário.

## Diagnóstico do portal real

Os testes comuns usam dados sintéticos e não acessam contas reais. Para o diagnóstico opcional, copie `.env.example` para `.env` e preencha `AO_MATRICULA` e `AO_PASSWORD` apenas nesse arquivo local, que é ignorado pelo Git:

```sh
pnpm diagnose:ao
pnpm diagnose:ao --expire-session
```

O script compõe o mesmo adaptador e os mesmos parsers com transporte e cookies em memória no Node. O segundo comando simula a perda de sessão e verifica a recuperação, inclusive de IDs derivados. A saída contém etapas, contagens e códigos de erro, sem credenciais ou HTML. Essa checagem não substitui a jornada no transporte nativo.

Para os documentos, há o `pnpm diagnose:documents`, descrito em [Emissão de documentos](emissao-de-documentos.md#diagnóstico-autenticado).

> [!WARNING]
> O `.env` é só seu. Nunca o commite, nunca cole o conteúdo dele em issues ou PRs e não use a conta de outra pessoa.

## Ferramentas de desenvolvimento

Login automático com a conta do `.env`, deep links de debug (`aouerj-dev://`), capturas de tela e testes E2E com o Maestro estão em [scripts/dev/README.md](../scripts/dev/README.md). As capturas e os relatórios do Maestro mostram dados reais da conta: ficam só na sua máquina.
