# iOS

O app tem código para o iPhone, mas o foco é o Android, publicado na Google Play.

> [!IMPORTANT]
> O código nativo do iOS foi escrito sem Mac e não está na App Store. Quem confere que ele compila e abre é o workflow manual [`ios.yml`](#o-workflow-iosyml): rode-o antes de publicar qualquer coisa que mexa em `ios/`.

## Estado atual

- **Compila no CI:** o `ios.yml` (macOS, manual) compila o app e a extensão do widget em Release e abre o app num simulador.
- **Fora da App Store:** o `release.yml` publica só o Android; o iPhone ainda não tem distribuição.
- **Identificação do aluno:** no servidor, sem `APPLE_APP_ATTEST_APP_ID`, a entrada do iPhone responde 503 `student_identity_unavailable`, e as funções entre alunos não abrem nele (ver [server/README.md](../server/README.md#identificação-do-aluno-v2)).
- **Versão:** `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` ficam no `project.pbxproj` e mudam à mão (ver [Release](release.md#versão)). O alvo mínimo é o iOS 16.4, o dos módulos do Expo SDK 58 (o `expo-updates`).

## Rodar no macOS

Precisa de macOS, Xcode, Ruby/Bundler e CocoaPods. Depois do `pnpm install`:

```sh
bundle install
bundle exec pod install --project-directory=ios
pnpm ios
```

No Windows e no Linux, não há como compilar o iOS: use o `ios.yml`.

## O workflow `ios.yml`

Roda só por `workflow_dispatch`, num runner `macos-15` (Actions > iOS simulator build > Run workflow).

1. Instala as dependências (`pnpm install --frozen-lockfile` e `pod install`). Antes do `pod install`, calcula o runtime version das atualizações OTA (`node scripts/ota/runtime-version.cjs ios`) e o passa ao build pelo `EXPO_UPDATES_FINGERPRINT_OVERRIDE` (ver [Atualizações OTA](#atualizações-ota)).
2. Compila em **Release**, como vai para a loja: o Xcode empacota o JS de iOS (o que só quebra nessa plataforma: resolução de módulos, assets) e o Hermes o compila.
3. Assina para rodar localmente ("Sign to Run Locally", `CODE_SIGN_IDENTITY=-`, sem conta da Apple). Sem assinatura, o app fica sem os entitlements, e o Keychain do simulador recusa tudo (`-34018`), o que o iPhone de verdade não faz.
4. Confere que o app leva o `Expo.plist` e o `EXUpdates.bundle`, com o manifesto do JS embutido e o mesmo runtime version que o publicador calcula.
5. O `scripts/ci/ios-smoke.sh` abre o app no iPhone simulado mais novo do runner e confere que ele não cai: na abertura (o login), no tema escuro, no link `aouerj://open?target=home`, numa segunda abertura e numa rodada da verificação em segundo plano. As capturas e o log ficam no artefato `ios-smoke` por 14 dias.

O que depende do login fica nos testes do Jest, que rodam como iOS (ver [Testes](#testes)).

## Módulos nativos

As specs de `src/specs` com implementação no iPhone ficam em `ios/AOUerjMobile/Native/*.mm`, registradas pelo `codegenConfig.ios.modulesProvider` do `package.json`. São 4 das 6: `DeviceTrust` (Play Integrity) e `InAppUpdates` (Play) só existem no Android.

- **`SecureVault`:** o cofre cifrado, com ECIES (P-256 no Keychain, só deste aparelho) e arquivos em Application Support fora do backup. Dá o cache de 180 dias e "Guardar no aparelho" nos documentos.
- **`AppNotifications`:** permissão e lembretes no `UNUserNotificationCenter`, como avisos de data única até a validade do plano.
  - O iOS guarda só os 64 avisos agendados mais próximos. Os lembretes usam até 60: as provas e trabalhos primeiro (até 20, com o "Já fiz" tratado na `LaunchCenter.swift`) e as aulas com o resto (sem avaliações anotadas, as aulas ficam com os 60). Os avisos da Companhia agora ficam nos 4 lugares livres.
  - Também lê o destino das aberturas, guardado pela `LaunchCenter.swift`, e leva a verificação em segundo plano ao `BGTaskScheduler` (abaixo).
- **`HomeWidget`:** grava a grade no App Group `group.com.aouerjmobile`, que a extensão `ios/NextClassWidget` (WidgetKit) lê para os widgets "Próxima aula" e "Hoje". A `WidgetStore.swift` (a grade, a regra da próxima aula e os textos) entra nos dois alvos.
- **`AppAttest`:** a sessão de aluno (ver [Arquitetura](arquitetura.md#sessão-de-aluno)), com o App Attest do DeviceCheck no lugar da Play Integrity, mais o SHA-2 do CommonCrypto e o `SecRandomCopyBytes`. O `DeviceCheck.framework` é ligado à mão no alvo, e o entitlement `com.apple.developer.devicecheck.appattest-environment` é `production`. No simulador, o App Attest não existe e o app não entra como aluno.

## Widgets, atalhos e App Intents

- **Widgets:** "Próxima aula" nos tamanhos pequeno e médio, mais o retangular da tela de bloqueio no iOS 16+; "Hoje" nos tamanhos médio e grande, com 3 ou 7 aulas. Eles se redesenham pela linha do tempo do WidgetKit, e não por alarmes como no Android.
- **App Intents:** "Próxima aula" e "Aulas de hoje" respondem pela Siri, pelo app Atalhos e pelo Spotlight com a grade salva, sem abrir o app (`AppShortcuts.swift`, com frases prontas do iOS 16 em diante). "Abrir no AO UERJ" (`OpenAppIntent.swift`, nos dois alvos) abre o Início, as notas, o mapa ou os documentos, e é a ação do controle "Próxima aula" da Central de Controle (iOS 18).
- **Aberturas:** o toque no aviso chega pelo delegate do `UNUserNotificationCenter`. Os atalhos do ícone (`UIApplicationShortcutItems` no `Info.plist`, com os mesmos destinos do Android) e o toque no widget (`aouerj://open?target=home`) chegam pela `SceneDelegate`, na abertura (`connectionOptions`) e com o app aberto.

## Ciclo de vida com cenas

Como no template do React Native 0.88 (e exigido pelo SDK do iOS 27), a janela fica na `SceneDelegate.swift` (`UIApplicationSceneManifest` no `Info.plist`). O React Native é um só por processo, na `AppReactNative` (no mesmo arquivo), que a cena e a verificação em segundo plano abrem. O `AppDelegate` limpa o `URLCache`, registra o delegate dos avisos e a tarefa do `BGTaskScheduler` e prepara o React Native e o `expo-updates`.

Como no template do Expo SDK 58, o `AppDelegate` é um `ExpoAppDelegate` (repassa os eventos do app aos módulos do Expo) e entrega a fábrica (`ExpoReactNativeFactoryProvider`), uma `ExpoReactNativeFactory` criada na abertura. A cena continua a do app, e não a `ExpoAppSceneDelegate` do template: o React Native pode já estar aberto sem janela, e nenhum módulo do Expo instalado usa os eventos de cena que aquela classe repassa. A cena só espelha a janela no `AppDelegate`.

## Atualizações OTA

O `expo-updates` usa o início próprio do app (`EX_UPDATES_CUSTOM_INIT` no `Podfile`, que exige os módulos do Expo compilados do código-fonte): o handler do Expo não cria a tela, e a `AppReactNative` decide quando abrir o React Native.

1. **Abertura:** o `prepare()` cria a fábrica e liga o `AppController` do `expo-updates`, que escolhe o pacote JS (o da instalação ou a última atualização baixada) em milissegundos, sem esperar a rede.
2. **Até a escolha:** a cena que se conectar mostra o `BootSplash.storyboard`, e a rodada em segundo plano espera. Escolhido o pacote, os dois abrem na ordem dos pedidos: o host sem janela primeiro, e a cena em seguida, nele.
3. **O pacote:** o `bundleURL()` da `AppReactNative` e o handler do Expo, que dá o endereço do host, devolvem o pacote escolhido. A rodada sem janela e a tela usam o mesmo, e um `Updates.reloadAsync()` troca o do host.
4. **No debug:** o `expo-updates` se desliga sozinho, e o JS vem do Metro.

A configuração fica no `ios/AOUerjMobile/Expo.plist` (o endereço, o runtime version lido do `EXUpdates.bundle`, a busca a cada abertura sem esperar e o certificado, cópia do `config/ota/certificate.pem` conferida pelo `pnpm test:tooling`). O `EXUpdates.bundle`, com o runtime version e o manifesto do JS embutido, sai no build, por uma fase do pod do `expo-updates`.

O `pod install` mexe no projeto do Xcode (o `ExpoModulesProvider.swift`, a fase "[Expo] Configure project", as flags do Swift), e um build feito depois dele calcularia outro runtime version. Por isso o `ios.yml` calcula o valor antes e o passa ao Xcode pelo `EXPO_UPDATES_FINGERPRINT_OVERRIDE`. Uma build para a loja, quando houver, precisa fazer o mesmo.

## Verificação em segundo plano

A verificação no portal e "Avisar quando voltar" usam uma `BGAppRefreshTask` (`com.aouerjmobile.portal-check`, em `BGTaskSchedulerPermittedIdentifiers` e com `fetch` em `UIBackgroundModes` no `Info.plist`), na `BackgroundCheck` do `AppDelegate.swift`.

- **Um pedido só:** o iOS guarda um só pedido desse tipo por app, então a tarefa leva os dois modos (`check` e `return`), cada um com a próxima vez no UserDefaults. O pedido é a mais próxima, fora das 22h às 7h, refeito a cada rodada e a cada mudança, e cancelado quando nada está ligado. Uma rodada roda também o modo que venceria nos 15 minutos seguintes.
- **Antes do React Native:** numa rodada, o app confere o horário, a tela bloqueada (a senha salva no Keychain só abre com o aparelho desbloqueado; a rodada fica para 15 minutos depois) e a permissão de avisos.
- **Com o app fechado:** nenhuma cena se conecta. Depois de o `expo-updates` escolher o pacote JS (ver [Atualizações OTA](#atualizações-ota)), a `AppReactNative` abre o host sem janela (a categoria `ao_startReactNativeWithoutWindow` do `AppNotificationsModule.mm`, que chama o `initializeReactHostWithLaunchOptions` do `RCTRootViewFactory`). Se o aluno abrir o app em seguida, a cena cria a tela nesse mesmo host, sem um segundo runtime. As opções de abertura da cena (link, atividade) não chegam a esse host; os destinos do app passam pela `LaunchCenter`.
- **No JS:** a rodada espera o JS assinar os eventos (`listenBackgroundTasks`) e chega a ele por `onBackgroundTask` (`{ id, modes }`). O JS (`src/app/background/backgroundRounds.ts`) roda a mesma tarefa do Android, com prazo de 25 segundos, e a encerra com `setTaskCompleted`. Quando o tempo do iOS acaba, `onBackgroundTaskExpired` para as consultas (os avisos do que já foi lido saem), e a rodada termina em até 2 segundos, com ou sem o JS.
- **Quem decide é o iOS:** a rodada parte do horário pedido, mas pode levar horas, não acontece com a "Atualização em 2º Plano" desligada nem depois de o aluno fechar o app no seletor de apps (até ele abrir de novo).
- **No simulador:** o `BGTaskScheduler` não roda. O `ios-smoke.sh` abre o app com `SIMCTL_CHILD_AO_SMOKE_BACKGROUND_CHECK=1`, que faz o `AppDelegate` seguir o caminho de uma rodada antes de a cena se conectar, e confere no log que o JS a encerrou e que a cena usou o React Native já aberto. Só o `simctl` ou o depurador definem a variável.

Os intervalos de cada verificação estão em [Notificações](notificacoes-e-widget.md#notificações).

## Fora do iPhone

- As leituras a cada 15 minutos da Companhia agora ("Me avise se tiver mesa") e do Agora no campus ("ainda está lá?"): o iOS não acorda o app com essa frequência (`frequentWatches` no `NotificationDevicePort`).
- A atualização dentro do app (`InAppUpdates` é da Play). O pedido de avaliação existe nos dois, pela API de cada loja.

## Outros detalhes

- **Reinstalação:** o Keychain sobrevive à desinstalação. Na primeira abertura de cada instalação no iOS, uma conta salva sem nenhum dado no AsyncStorage (cache e preferências) é esquecida, e quem reinstala não volta logado com a senha antiga. A regra está em `persistence/previous-install.ts`.
- **Fontes:** os nomes em `fontFamily` (`Inter-Regular`, `InterDisplay-SemiBold`…) são os nomes PostScript dos arquivos, o que o iOS exige.
- **Rede:** o portal (TLS 1.2 com ECDHE, certificado SHA-256 de 2048 bits) e o `pitrol.dev` (TLS 1.3) passam no App Transport Security sem exceções por domínio.

## Testes

O projeto `native` do Jest (os `*.test.tsx`) roda como iOS (`defaultPlatform: 'ios'` no preset do React Native), sem os módulos nativos. Os testes que dependem do sistema trocam `Platform.OS`. O projeto `unit` (os `*.test.ts`) roda no Node, sem o preset.

O `pnpm test:tooling` também confere o projeto do Xcode (`scripts/__tests__/ios-project.test.cjs`): o scheme e os alvos, os recursos e o manifesto de privacidade, os módulos do `codegenConfig` contra as specs, o App Attest, a tarefa em segundo plano no `Info.plist` e o nome do módulo na `SceneDelegate.swift`. O `scripts/__tests__/ota-runtime.test.cjs` confere o `Expo.plist` (o endereço, o certificado e o runtime version) e o que entra no runtime version.
