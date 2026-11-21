# Release

Como sai uma versão nova, para quem mantém o projeto. Para contribuir, você não precisa de nada daqui: o PR entra na `main`, e a versão sai depois.

```mermaid
flowchart LR
  push["Push na main"] --> tag["version-tag: tag do bump à mão"]
  tag --> rp["release-please: PR da próxima versão"]
  rp -->|"merge do PR"| ghr["Tag vX.Y.Z e GitHub Release"]
  tag -->|"tag criada agora"| prepare
  manual["Release manual, com a tag"] --> prepare
  ghr --> prepare["prepare: tag, versão e origem na main"]
  prepare --> release["github-release: notas do CHANGELOG, se falta"]
  prepare --> quality["Quality no commit exato"]
  quality --> play["play: AAB assinado"]
  quality --> appstore["app-store: IPA no App Store Connect"]
  play --> internal["Teste interno da Play"]
  play --> runtime["runtime-version: runtime de android no GitHub Release"]
  appstore --> runtimeios["runtime-version-ios: runtime de ios no GitHub Release"]
  internal -->|"à mão, no Play Console"| prod["Produção"]
  appstore -->|"revisão da Apple, no App Store Connect"| store["App Store"]
  push --> ota["Quality do push e OTA automático"]
```

Toda tag de versão na `main` vai para as duas lojas, e todo push na `main` com JavaScript novo sai também por OTA, para as builds que já estão nos aparelhos (ver [Atualizações OTA](ota.md)). Um OTA não é bump, e um bump não barra o OTA.

## Versão

- **Android:** o `package.json` é a fonte. O Gradle deriva o `versionName` (`vX.Y.Z`) e o `versionCode` (`MAJOR × 10⁷ + MINOR × 10⁴ + PATCH`; a 1.3.6 é 10030006). A fórmula exige MAJOR a partir de 1, MINOR até 999 e PATCH até 9999, e o build falha fora disso.
- **iOS:** `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` ficam nas configurações do projeto no `project.pbxproj` (o app e o widget herdam) e são atualizados à mão antes da publicação. Ficam fora do release-please porque o Xcode reescreve esse arquivo.
- **Manifest:** o `.release-please-manifest.json` registra a última release e evita que o release-please proponha de novo uma versão já publicada.

## Commits e changelog

O release-please lê os prefixos dos commits (a convenção está no [guia de contribuição](../CONTRIBUTING.md#commits)) para escolher a próxima versão e montar o `CHANGELOG.md`. As seções ficam em `release-please-config.json`: `feat` vai para "Novidades", `fix` para "Correções", `perf` para "Desempenho" e `revert` para "Reversões". Os outros tipos (`refactor`, `docs`, `test`, `build`, `ci`, `style`, `chore`) não aparecem.

## Pelo PR do release-please

A cada push na `main`, o release-please (`release.yml`) mantém um PR "chore: release X.Y.Z" com a próxima versão no `package.json` e o `CHANGELOG.md`.

1. Esse PR não mexe no `project.pbxproj`: antes do merge, suba a versão do iOS num commit no próprio branch do PR.
2. O merge cria a tag `vX.Y.Z` e o GitHub Release.
3. O workflow confere a versão e a origem da tag na `main` (`scripts/ci/release-ref.cjs`), roda o Quality no commit exato e só então compila o AAB com a chave de upload, no environment `play`.
4. O envio é para o teste interno. A promoção para produção é feita no Play Console.

A criação do PR pelo `GITHUB_TOKEN` não dispara CI, mas o gate da publicação sempre executa os checks.

## Com um bump à mão

1. Faça o commit `chore: release X.Y.Z` com:
   - a versão no `package.json`;
   - a mesma versão no `.release-please-manifest.json`;
   - a entrada no `CHANGELOG.md`;
   - `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` (+1) no `project.pbxproj`.
2. Envie os commits das mudanças e o do bump num push só. Se as mudanças subirem antes, o release-please abre um PR propondo a próxima versão, e o bump não o fecha.
3. No push, o job `version-tag` (`scripts/ci/version-tag.cjs`) acha o commit do bump e, se a tag `vX.Y.Z` não existir, a cria anotada nesse commit, com a data dele. Ele nunca move uma tag e pula os merges do PR do release-please.
4. Uma tag criada por ele publica a versão no mesmo run: o job `github-release` cria o GitHub Release com a seção do `CHANGELOG.md` e as linhas "Android: versão vX.Y.Z, código N." e "iPhone: versão X.Y.Z, build B." (`scripts/ci/release-notes.cjs`), e a versão vai para a Play e para a App Store. Não crie a tag à mão antes do push: com ela, o job não a cria e nada é publicado (aí, acione o workflow Release com a tag, abaixo).

Por que a tag importa: o release-please procura a versão do manifest como GitHub Release ou, sem ele, como a tag `vX.Y.Z`. Sem nenhum dos dois, volta ao `bootstrap-sha` e propõe uma 2.0.0 com o histórico inteiro.

## Publicar ou retomar uma publicação

Em Actions > Release > Run workflow, selecione `main` e informe a tag existente, por exemplo `v2.1.0`. O mesmo pode ser feito com:

```sh
gh workflow run release.yml --ref main -f tag=v2.1.0
```

- Isso repete os checks e o envio sem criar tag nem aumentar a versão.
- Para retomar, use quando a falha ocorreu antes de a Play aceitar o AAB. Se o `versionCode` já foi enviado, use o release existente no Console.
- Tags fora da `main` ou divergentes do `package.json` são recusadas.
- Secrets ausentes, JSON inválido e erros de keystore, alias ou senhas falham antes do build de publicação, sem expor valores.

O job `play` guarda no artefato do run o AAB, o `mapping.txt` e, quando existe, o `native-debug-symbols.zip`. Os símbolos nativos também vão dentro do AAB (`ndk.debugSymbolLevel`), onde a Play os lê.

## Runtime da build

Antes do Gradle, o job `play` calcula o runtime version que a build embute (`node scripts/ci/ota-check.cjs runtime android`). Depois que a Play aceita o AAB, o job `runtime-version` o grava no GitHub Release da versão, como o asset `runtime-version-android.txt`. É por ele que o [OTA](ota.md#a-regra-de-compatibilidade) sabe para qual build pode publicar.

- Uma falha no cálculo não barra a publicação: a versão sai na Play sem o registro, o job `runtime-version` falha, e o OTA não conta com essa build.
- O registro espera o job `github-release`, que cria o GitHub Release quando ele falta.

## Na App Store

O job `app-store` chama o [`ios-app-store.yml`](ios.md#envio-à-app-store) no commit da tag, com o `CURRENT_PROJECT_VERSION` dela como número da build: compila, assina e envia o IPA ao App Store Connect. O job `runtime-version-ios` grava o runtime dessa build no GitHub Release, como o `runtime-version-ios.txt`.

Falta a parte que é do App Store Connect: criar a versão, escolher a build, escrever o "O que há de novo" e mandar para a revisão (ver [Envio à App Store](ios.md#envio-à-app-store)). Num retry, use "Re-run failed jobs": a Apple recusa um número de build já enviado.

A revisão da Apple leva de horas a dias, e o iPhone pode ficar uma versão atrás do Android. Leve isso em conta antes de subir a versão mínima do [aviso remoto](aviso-remoto.md#minsupportedversion).

## Configuração no GitHub

Habilite "Allow GitHub Actions to create and approve pull requests" e crie o environment `play`, com aprovação obrigatória e restrito à `main`, com os secrets:

- `ANDROID_KEYSTORE_BASE64`: a keystore de upload em base64 (`base64 -w0 upload.keystore`);
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`;
- `PLAY_SERVICE_ACCOUNT_JSON`: o JSON de uma conta de serviço do Google Cloud com a API Google Play Android Developer ativa e permissão de release no app (Play Console > Usuários e permissões);
- opcional: o secret `SENTRY_AUTH_TOKEN` e as variáveis `SENTRY_ORG` e `SENTRY_PROJECT`, para enviar os source maps à região UE. Sem o token, o envio é pulado (ver [Observabilidade](observabilidade.md#source-maps-e-símbolos));
- `OTA_SIGNING_KEY`: a chave privada dos updates OTA, em PEM, usada só pelo workflow OTA (ver [Chave e certificado](ota.md#chave-e-certificado)).

A implantação do servidor usa outro environment, o `production`; ver [server/README.md](../server/README.md#implantação).
