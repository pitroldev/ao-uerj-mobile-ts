# AO UERJ

Aplicativo não oficial do Aluno Online da UERJ, em React Native 0.88, React 19.3 e TypeScript. Consulta notas, histórico, currículo, disciplinas, RID e horários e emite documentos. Também oferece progresso acadêmico, plano até a formatura, quanto falta na PF com simulação do CR, controle de faltas, geração de grades, mural de mensagens e mapa offline do campus. Tem ainda widget, atalhos e lembretes de aula. No Android, também avisa de nota nova, RID e documento perto de vencer.

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

`pnpm type-check` usa o TypeScript 7 nativo (`@typescript/native`). O pacote `typescript` é o alias `@typescript/typescript6`, que mantém a API JS do TypeScript 6 para o editor (o `@styled/typescript-styled-plugin` roda no tsserver). `pnpm lint` roda o Oxlint (`.oxlintrc.json`), com as regras que usam tipos (`oxlint-tsgolint`, sobre o TypeScript 7), e falha com qualquer aviso. A formatação fica só com o Prettier: `pnpm format:check` confere o repositório e `pnpm format` corrige. O CI (`quality.yml`) executa instalação congelada, lint, formatação, TypeScript, Knip (dependências, arquivos e exports sem uso), testes, build debug e AAB release (R8) com uma keystore descartável. Esse AAB serve apenas à validação. O workflow iOS (`ios.yml`) é acionado manualmente em macOS: empacota o JS para iOS em modo release e compila o app para o simulador, sem assinatura.

### iOS

- **Módulos nativos no iPhone:** as specs de `src/specs` têm implementação em `ios/AOUerjMobile/Native/*.mm`, registradas pelo `codegenConfig.ios.modulesProvider` do `package.json`:
  - `SecureVault`: o cofre cifrado, com ECIES (P-256 no Keychain, só deste aparelho) e arquivos em Application Support fora do backup. Dá o cache de 180 dias e "Guardar no aparelho" nos documentos;
  - `AppNotifications`: permissão e lembretes de aula no `UNUserNotificationCenter`, como avisos de data única até a validade do plano. O iOS guarda 64 avisos agendados, e o app usa até 60. Também lê o destino das aberturas, guardado pela `LaunchCenter.swift`;
  - `HomeWidget`: grava a grade no App Group `group.com.aouerjmobile`, que a extensão `ios/NextClassWidget` (WidgetKit) lê. A `WidgetStore.swift` entra nos dois alvos.
- **Ciclo de vida com cenas:** como no template do React Native 0.88 (e exigido pelo SDK do iOS 27), a janela e o React Native ficam na `SceneDelegate.swift` (`UIApplicationSceneManifest` no `Info.plist`); o `AppDelegate` só limpa o `URLCache` e registra o delegate dos avisos.
- **Aberturas:** o toque no aviso chega pelo delegate do `UNUserNotificationCenter`; os atalhos do ícone (`UIApplicationShortcutItems` no `Info.plist`, com os mesmos destinos do Android) e o toque no widget (`aouerj://open?target=home`) chegam pela `SceneDelegate`, na abertura (`connectionOptions`) e com o app aberto.
- **Fora do iPhone:**
  - a verificação no portal em segundo plano (notas, RID e documentos) e "Avisar quando voltar": o `BGTaskScheduler` não garante horário. A tela de Notificações mostra só os lembretes (`backgroundChecks` no `NotificationDevicePort`);
  - atualização e avaliação dentro do app (`InAppUpdates` é da Play).
- **Sem compilação local:** o código nativo do iOS foi escrito sem Mac. O `ios.yml` (macOS, manual) compila o app e a extensão; rode-o antes de publicar.
- **Reinstalação:** o Keychain sobrevive à desinstalação. Na primeira abertura de cada instalação, uma conta salva sem nenhum dado no AsyncStorage (cache e preferências) é esquecida, e quem reinstala não volta logado com a senha antiga. A regra está em `persistence/previous-install.ts`.
- **Testes:** o Jest roda como iOS (`defaultPlatform: 'ios'` no preset do React Native), sem os módulos nativos. Os testes que dependem do sistema trocam `Platform.OS`.
- **Fontes:** os nomes em `fontFamily` (`Inter-Regular`, `InterDisplay-SemiBold`…) são os nomes PostScript dos arquivos, o que o iOS exige.
- **Rede:** o portal (TLS 1.2 com ECDHE, certificado SHA-256 de 2048 bits) e o `pitrol.dev` (TLS 1.3) passam no App Transport Security sem exceções.
- **Para publicar na App Store, falta:**
  - definir `DEVELOPMENT_TEAM` e registrar os App IDs `com.aouerjmobile` (o mesmo identificador do Android) e `com.aouerjmobile.NextClassWidget`, os dois com o App Group `group.com.aouerjmobile`;
  - preencher a privacidade no App Store Connect: relatos e mural vão para o servidor próprio, falhas vão para o Sentry;
  - criar no `release.yml` um envio ao TestFlight, que hoje não existe.

## Commits, versão e release

- **Commits:** a mensagem é livre, sem prefixo obrigatório. O `pnpm install` instala os hooks do lefthook (`lefthook.yml`): Oxlint e Prettier nos arquivos staged no pre-commit e type-check no pre-push. Prefixos como `feat:` e `fix:` continuam opcionais para que o release-please reconheça mudanças na geração automática da versão e do changelog.
- **Versão:** o `package.json` é a fonte do Android. O Gradle deriva `versionName` (`vX.Y.Z`) e `versionCode` (`MAJOR × 10⁷ + MINOR × 10⁴ + PATCH`). No iOS, `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` ficam nas configurações do projeto no `project.pbxproj` (o app e o widget herdam) e são atualizados manualmente antes da publicação; ficam fora do release-please porque o Xcode reescreve esse arquivo.
- **Release:** a cada push na `main`, o release-please (`release.yml`) mantém um PR com a próxima versão e o `CHANGELOG.md`. O merge cria a tag `vX.Y.Z` e o GitHub Release. O workflow confere a versão e a origem da tag na `main`, roda o Quality no commit exato e só então compila o AAB com a chave de upload no environment `play`. O envio é para o teste interno; a promoção para produção é feita no Play Console. A criação do PR pelo `GITHUB_TOKEN` não dispara CI, mas o gate da publicação sempre executa os checks.
- **Release manual:** registre a versão no `CHANGELOG.md` e no `.release-please-manifest.json`, crie a tag correspondente na `main` e publique o GitHub Release. Depois acione o workflow Release informando essa tag. O manifest registra a última release e evita que o release-please proponha novamente uma versão já publicada.
- **Configuração no GitHub:** habilite "Allow GitHub Actions to create and approve pull requests" e crie o environment `play`, com aprovação obrigatória e restrito à `main`, com os secrets:
  - `ANDROID_KEYSTORE_BASE64`: a keystore de upload em base64 (`base64 -w0 upload.keystore`);
  - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`;
  - `PLAY_SERVICE_ACCOUNT_JSON`: JSON de uma conta de serviço do Google Cloud com a API Google Play Android Developer ativa e permissão de release no app (Play Console > Usuários e permissões).
  - Opcional: secret `SENTRY_AUTH_TOKEN` e variáveis `SENTRY_ORG`/`SENTRY_PROJECT`, para enviar source maps à região EU. Sem o token, o envio é pulado.
- **Retomar publicação:** em Actions > Release > Run workflow, selecione `main` e informe a tag existente, por exemplo `v2.1.0`. O mesmo pode ser feito com `gh workflow run release.yml --ref main -f tag=v2.1.0`. Isso repete os checks e o envio sem criar tag ou aumentar a versão. Use quando a falha ocorreu antes de a Play aceitar o AAB; se o `versionCode` já foi enviado, use o release existente no Console. Tags fora da `main` ou divergentes do `package.json` são recusadas. Secrets ausentes, JSON inválido e erros de keystore/alias/senhas falham antes do build de publicação, sem expor valores.
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
src/modules/notifications/       lembretes de aula e avisos do portal (nota, RID, documento)
src/modules/widget/              widget "Próxima aula" da tela inicial
src/modules/attendance/          faltas marcadas pelo aluno, só no aparelho
src/modules/graduation/          plano até a formatura (pré-requisitos, carga e prazo)
src/modules/launch/              aberturas de fora do app (aviso, atalho do ícone, widget)
src/app/background/              tarefa sem tela da verificação de avisos (WorkManager)
src/adapters/outbound/           AO, APIs privadas, aviso remoto, armazenamento e recursos nativos
src/specs/                       specs do codegen para TurboModules locais (In-App Updates, avisos, widget)
src/pages/ e src/features/       telas e componentes de apresentação
src/shared/                      erros compartilhados
```

O Oxlint impede imports de React, SDKs, adaptadores e estado global em domínio/aplicação. As queries acadêmicas usam conta e contexto do portal na chave. Cookies e tokens não participam das chaves. Os componentes não copiam respostas para outro armazenamento de estado.

O coordenador AO centraliza login, token, códigos de requisição e renovação concorrente. Uma consulta expirada permite um único replay; erros transitórios têm repetição limitada nas queries. Parsers diferenciam página vazia reconhecida de estrutura inesperada.

O gerador exige uma ação explícita para enviar a solicitação. Seus detalhes são carregados com concorrência limitada e cancelamento. Mensagens, suporte e geração usam APIs próprias, distintas do portal UERJ.

## Persistência e privacidade

- Credenciais e identificação da conta ficam no Keychain/Keystore por `react-native-keychain`.
- Cookies, token e IDs de requisição são efêmeros e pertencem ao adaptador AO.
- O cache acadêmico persistido tem dono explícito, e a interface conserva a última resposta em falhas de atualização.
  - No Android, ele fica no cofre do app: AES-256-GCM, chave não exportável no Android Keystore, arquivos fora do backup (`noBackupFilesDir`).
  - Lá, grade, notas, histórico, currículo, Síntese e disciplinas universais valem 180 dias, e o RID e os detalhes de disciplinas valem 7 dias. A cópia antiga, sem cifra, é lida uma vez na atualização e apagada na primeira gravação.
  - Sem o cofre (iOS), o cache segue no AsyncStorage, sem criptografia, com validade de sete dias para tudo.
- Os PDFs que o aluno pede para guardar (ver [Sem internet ou com o portal fora do ar](#sem-internet-ou-com-o-portal-fora-do-ar)) ficam no mesmo cofre, no máximo 5 por conta, e o logout os apaga. Só no Android.
- Durante uma queda do portal, o app consulta `https://pitrol.dev/aouerj/portal-status`, no máximo a cada 2 minutos. A requisição não leva dados do aluno, mas o servidor vê o IP do aparelho e o horário.
- O logout invalida resultados tardios, aguarda operações nativas, limpa cookies, credenciais e cache da conta.
- A migração do antigo Redux persistido transfere credenciais para armazenamento seguro e remove a cópia em texto simples. Se a transferência falhar, um novo login pode ser necessário.
- Relatórios de suporte enviam diagnóstico estruturado e descrição sanitizada. Não coletam HTML bruto, senha, cookies ou tokens do portal. Com o Sentry ativo, o diagnóstico leva também o id do evento de feedback correspondente.
- Mensagens enviam nome do autor, turma, disciplina, período escolhido e texto. O gerador envia dados necessários ao cálculo. Este repositório cliente não comprova políticas de retenção dos servidores.
- O aviso remoto (ver [Aviso remoto](#aviso-remoto)) está sempre ligado. O app baixa `config/app-status.json` deste repositório em `raw.githubusercontent.com` na abertura, ao voltar ao primeiro plano e, em segundo plano, quando a verificação de avisos vai de fato consultar o portal (antes disso, vale a cópia salva). Faz isso no máximo a cada 15 minutos, inclusive antes do login. A requisição não leva dados do aluno, mas o GitHub (Microsoft, nos EUA) vê o IP do aparelho, o horário e o User-Agent. Os links "Saiba mais" dos avisos só abrem hosts permitidos.
- Atualização e avaliação usam as APIs da própria loja (In-App Updates e In-App Review da Play), que passam pelo app da loja no aparelho; o app não envia dados próprios nesses fluxos.
- Tema, última cópia do aviso remoto, avisos dispensados, data do último pedido de atualização e o histórico de uso que decide o pedido de avaliação ficam no AsyncStorage. Valem para o app inteiro e não são apagados no logout.
- Avisos (ver [Notificações](#notificações)) são opt-in e montados no aparelho; nada passa por servidores próprios. As escolhas, o estado da última verificação e a referência dos avisos (as últimas notas, posições no RID Parcial e resultados da inscrição lidos no período) ficam no AsyncStorage por conta. Os lembretes de aula (disciplina, horário e sala) ficam nas SharedPreferences do Android. O logout apaga tudo isso e cancela lembretes e verificações.
- O widget "Próxima aula" (ver [Widget e atalhos](#widget-e-atalhos)) guarda a grade salva (disciplina, horário e sala) nas SharedPreferences do Android para desenhar com o app fechado. O logout a apaga, e o widget passa a pedir o login.
- As faltas que o aluno marca (ver [Notas, PF e faltas](#notas-pf-e-faltas)) ficam só no aparelho, no AsyncStorage por conta e por período, e o logout as apaga, inclusive o automático, quando o portal recusa a senha salva. A simulação de PF e CR não grava nada.
- O Plano até a formatura (ver [Plano até a formatura](#plano-até-a-formatura)) é calculado no aparelho. Os pré-requisitos lidos na Pesquisa de Disciplinas, a carga escolhida e os adiamentos ficam no AsyncStorage por conta, e o logout os apaga.

Quando o AO não informa o semestre, a interface usa "Período atual". O período do mural é um filtro selecionado pelo usuário; não é uma confirmação do calendário acadêmico oficial.

### Sem internet ou com o portal fora do ar

- **Abertura:** com a conta salva, o app abre na hora com os dados salvos e entra no portal por trás ("Entrando no Aluno Online…"). As leituras esperam esse login, sem um segundo login em paralelo. Uma senha recusada nesse login leva ao Login.
- **Sem internet:** as consultas pausam e voltam com a conexão (como antes).
- **Portal fora do ar:** com a internet funcionando, uma resposta 502, 503 ou 504, ou duas falhas de rede seguidas, marcam o portal como fora do ar.
  - Daí em diante, as leituras falham na hora, sem esperar o tempo-limite.
  - Uma requisição leve à página inicial do portal testa a volta, com espera crescente: 1, 2, 5, 10 e depois 15 minutos. O teste só acontece com o app na tela.
  - Uma leitura pedida (tela aberta, "Tentar novamente", puxar para atualizar) também dispara o teste, no máximo a cada 30 segundos.
  - O aviso de cada tela diz desde quando e a próxima tentativa, e oferece "Tentar agora".
  - Com a situação do nosso servidor (ver acima), o aviso diz se a queda é de todos ou se o problema pode ser a rede do aluno.
  - Quando o portal volta, o app avisa "O Aluno Online voltou" e atualiza as telas que falharam.
- **Lentidão:** uma resposta acima de 8 segundos troca a barra de atualização por "O Aluno Online está lento".
- **Avisar quando voltar** (Android): no aviso da queda, o aluno pede um aviso. Fora do app, uma tarefa do WorkManager testa o portal a cada 15 minutos, com rede e fora das 22h às 7h, avisa uma vez no canal "Aluno Online de volta" e para. O pedido vence em 3 dias e sai no logout.
- **Busca antecipada:** com a conta logada, internet, o portal no ar e o app na tela, grade, histórico, currículo e Síntese vencidos são renovados, uma página por vez, no máximo a cada 30 minutos por conta. Notas e RID ficam de fora, porque a verificação de avisos compara com o que o aluno já viu.
- **Ações que dependem do portal:** emitir e excluir documentos e "Ler os pré-requisitos de novo" ficam desativados sem internet ou com o portal fora do ar.
- **Documentos guardados** (Android): na folha do PDF, "Guardar no aparelho" mantém o documento cifrado no cofre. A seção "Guardados no aparelho" abre e compartilha o PDF sem internet e sem o portal.

### Notas, PF e faltas

As contas seguem o art. 95 da Deliberação nº 33/CSEPE/1995, que o Aluno Online publica em "Critérios de Avaliação (Crédito)". O regime seriado (Deliberação nº 44/1979) tem outra conta e não é coberto.

- **Quanto preciso na PF:** no quadro de notas do Início, cada disciplina diz o que falta para passar por nota.
  - A média semestral é a média de P1 e P2. A partir de 7,0, o rótulo é "Dispensado da PF".
  - Abaixo de 4,0, é "Sem direito à PF": a disciplina reprova mesmo que uma PF apareça lançada.
  - Entre 4,0 e 7,0, é "Precisa de X na PF", com X = 10 − média, arredondado para cima na primeira casa. Essa nota aparece tracejada na coluna da PF.
  - Só com uma das provas, o rótulo diz quanto a outra precisa para dispensar a PF ("6,5 na P2 dispensa a PF"). Quando nem 10 dispensa, diz quanto ela precisa para dar direito à PF ("Precisa de 5,0 na P1 para ter PF").
  - Com a PF lançada ou a média publicada, mostra a média final, (média + PF) ÷ 2, que aprova com 5,0.
  - As notas aparecem com uma casa, e a segunda só quando existe. Elas são cortadas em vez de arredondadas, e assim nada abaixo de 5 aparece como "5,0".
- **Simular PF e CR:** a folha começa cada PF na nota mínima, de novo a cada abertura, e muda a nota de 0,5 em 0,5. Mostra a média final de cada disciplina e o CR aproximado de agora e com as notas do período.
  - Os créditos vêm do histórico, do currículo ou das disciplinas universais. A folha os lê ao abrir, do cache (que vale 24 horas) ou do portal.
  - O histórico só lista as disciplinas do período depois que ele termina; a partir daí, o período não conta duas vezes.
  - O CR segue a mesma regra aproximada do Meu Progresso. Atividades sem crédito ficam de fora, e sem nenhuma nota no histórico não há CR atual.
  - Também ficam de fora as disciplinas sem as duas provas e sem média lançada.
- **Controle de faltas:** o aluno marca "Faltei" de dois jeitos: tocando numa aula já terminada da agenda da semana, ou em "Faltas", em Disciplinas em Curso, que lista as aulas das últimas 4 semanas e as faltas mais antigas.
  - O limite é de 25% da carga horária (a frequência mínima é de 75% das horas-aula), contado em tempos de aula de 50 minutos.
  - A carga horária vem das mesmas fontes dos créditos. Sem ela, não há limite nem barra.
  - Disciplinas em Curso mostra a barra de cada disciplina: verde abaixo da metade do limite, amarela da metade até o limite e vermelha além dele.
  - A lista sai da grade e não conhece feriados nem o começo das aulas; nesses dias, basta não marcar.
  - O portal não mostra a frequência do período em curso, só a do histórico.

### Plano até a formatura

Em Meu Progresso, o cartão "Plano até a formatura" abre a tela do plano: as obrigatórias que faltam distribuídas pelos próximos períodos, com os pré-requisitos, os gargalos e o prazo máximo do curso.

- **Fontes:**
  - O currículo e o histórico dizem o que falta. As disciplinas da grade do período contam como aprovadas.
  - A Síntese da Formação dá a versão curricular, os créditos que faltam em cada grupo e o prazo. Os períodos restantes são o máximo, mais os extras, menos os utilizados (os cursados e o inscrito).
  - Em Meu Progresso, os créditos exigidos de cada grupo de eletivas também vêm da Síntese, e esses grupos não se configuram à mão. Os que ela não informa, ou todos quando ela não carrega ou o regime é seriado, usam os créditos configurados. Um grupo com 0 crédito exigido aparece como "Não exigida".
  - Os pré-requisitos vêm da Pesquisa de Disciplinas, uma página por disciplina que falta, duas por vez. Na primeira abertura, a tela mostra o progresso da leitura. As leituras ficam guardadas por versão curricular, e as aberturas seguintes não consultam o portal. Uma leitura interrompida continua de onde parou.
  - A leitura para em bloqueio, limite de acessos, portal fora do ar, falta de rede ou sessão perdida. O plano usa o que já foi lido e oferece "Tentar novamente". "Ler os pré-requisitos de novo" esquece as leituras e consulta tudo outra vez, sem o cache das páginas.
- **Regras:**
  - Cada grupo de pré-requisitos é um "ou", e todos os grupos valem. Um grupo com uma só alternativa entre as que faltam vira dependência.
  - Gargalo é a disciplina que trava, direta ou indiretamente, ao menos 3 outras. A cadeia mais longa de dependências é o mínimo de períodos possível.
  - A trava de créditos ("60 Créditos Obrigatórios") conta os créditos obrigatórios aprovados, com os do período em curso.
  - A carga é contada em disciplinas por período, com no mínimo 2, o piso da inscrição. "Quando formar" lista as formaturas possíveis, cada uma com a menor carga que chega lá. O padrão é a mais cedo, e uma carga maior que não adianta a data não vira opção.
  - Cada período recebe, até a carga, primeiro as disciplinas que travam outras; depois, pelo período recomendado no currículo. Um período fica com 1 disciplina só quando não há outra disponível, e o cartão avisa que ele está abaixo do mínimo da inscrição.
  - As eletivas entram como vagas "a escolher", no tamanho mais comum das disciplinas do grupo.
  - "Adiar um período", na folha da disciplina, guarda o período a partir do qual ela pode entrar. Antes, a folha mostra o efeito na formatura. "Restaurar o plano" desfaz todos os adiamentos.
- **Limites:**
  - O plano não conhece vagas, horários, a oferta de cada período nem correquisitos. A inscrição de verdade pode mudar.
  - Sem a Síntese, não há prazo, e os créditos exigidos das eletivas são os configurados em Meu Progresso.
  - Uma disciplina sem os pré-requisitos lidos entra como livre, com aviso. Uma que depende de disciplina fora das que faltam fica fora do plano, também com aviso.
- Para desligar a tela sem nova versão, inclua `graduation-plan` em `disabledFeatures` do aviso remoto.

### Notificações

A tela **Notificações** (só no Android) liga cada aviso separadamente; o Início convida uma vez a ligar o lembrete de aula.

- **Lembrete antes da aula:** 10, 15 ou 30 minutos antes, a partir da grade salva, sem consultar o portal.
  - O `AlarmManager` repete cada aula toda semana e refaz os alarmes depois de reiniciar o aparelho, atualizar o app ou mudar o relógio.
  - Enquanto houver lembretes, o WorkManager também os refaz a cada 6 horas, sem rede e sem abrir o app. Assim, retirar "Alarmes e lembretes" pausa os lembretes por no máximo esse tempo.
  - Sem "Alarmes e lembretes" liberado (Android 12+), o sistema entrega o lembrete numa janela de até 10 minutos antes do horário. Se o app reagenda dentro dessa janela, o lembrete sai na hora. Com o celular parado (Doze), pode atrasar.
  - Um lembrete que chegaria depois do início da aula é descartado. Uma aula já avisada não é avisada de novo, nem ao mudar a antecedência.
  - Os lembretes param 21 dias depois da última leitura da grade e não conhecem feriados. Sem a grade salva (o cache em disco perdeu a validade ou foi apagado), os lembretes já agendados continuam até essa validade.
- **Avisos do Aluno Online:** nota nova ou alterada, posição ou situação nova no RID Parcial, resultado da inscrição (aceitas e não aceitas, com o motivo) e documento emitido a até 3 dias de vencer.
  - O WorkManager roda a verificação em JS sem tela (`src/app/background`) a cada 4 horas, com rede e bateria não baixa. Das 22h às 7h, ou com as notificações desligadas no sistema, nem inicia o app.
  - Antes de qualquer acesso à rede, a verificação decide com o que está no aparelho: horário, pausa, avisos ligados da conta salva e a cópia salva do aviso remoto. Só então busca o aviso remoto e entra no portal.
  - Cada rodada faz uma autenticação e consulta só as páginas dos avisos ligados. Os documentos e a grade são consultados no máximo uma vez a cada 20 horas; a grade, só com o lembrete de aula ligado.
  - Se o login falha, a rodada para. Uma página fora do menu da conta, como o RID fora da época de inscrição, não interrompe as outras.
  - Pausa por 12 horas depois de um bloqueio ou limite de consultas do portal, de um login que o portal não abre (HTTP 4xx ou página desconhecida) ou de senha recusada. Com o app na tela, não roda.
- A verificação compara cada aviso com uma referência: o que o app mostrou (o cache) mais o que a própria verificação já leu no período.
  - A primeira leitura vira referência, sem aviso, e o que o aluno já viu no app não volta como aviso.
  - Uma leitura vazia ou em branco não apaga a referência: um dado que some e volta igual não avisa de novo.
  - Os documentos são a exceção: avisam pelo prazo já na primeira verificação, uma vez por via.
- Com o app em segundo plano, a volta da rede não recarrega os dados. Eles atualizam quando o app volta à tela, e a verificação não perde a mudança.
- O texto da nota só leva o valor se o aluno pedir. Na tela de bloqueio que oculta conteúdo sensível, os avisos mostram uma versão genérica.
- O logout, a troca de conta e o logout automático por senha recusada tiram da barra os avisos já mostrados e cancelam os lembretes.
- Para desligar tudo sem nova versão, inclua `notifications` em `disabledFeatures` do aviso remoto. A tela fica indisponível, e os lembretes e a verificação são cancelados na abertura do app ou na próxima verificação em segundo plano.
  - Só com o lembrete de aula ligado não há verificação em segundo plano, e o cancelamento espera a abertura do app.
  - Eles voltam quando o aluno abre o app depois da correção.

### Widget e atalhos

Só no Android, sem acesso ao portal.

- **Widget "Próxima aula"** (4×1, redimensionável): a próxima aula da grade salva, pela mesma regra do card do Início.
  - Um bloco à esquerda traz o dia ("Agora", "Hoje" ou o dia da semana) e o horário de início, em azul cheio quando a aula é hoje. Ao lado vêm a disciplina, o fim da aula com os tempos e a sala, e o local.
  - O texto do bloco tem tamanho fixo e não cresce com a fonte do sistema. O leitor de tela lê o dia e o horário pela descrição do widget.
  - O app envia a grade ao widget sempre que ela muda, com o app aberto. Em segundo plano, isso só acontece quando a verificação de avisos relê a grade; ver [Notificações](#notificações). Sem avisos ligados, o widget se atualiza ao abrir o app.
  - O widget se redesenha quando a aula mostrada começa ou termina, à meia-noite e depois de mudar o relógio, reiniciar ou atualizar o app. O alarme nunca acorda o aparelho. Com "Alarmes e lembretes" liberado (a permissão dos lembretes), chega no minuto certo; sem ela, pode atrasar até 10 minutos.
  - Depois do logout, pede o login. Pede para abrir o app em dois casos: antes de receber a primeira grade (widget posto antes de abrir o app) ou com a conta sem grade lida, e com a grade parada há mais de 21 dias.
  - Sem nenhuma disciplina em curso com horário, mostra "Sem aulas na grade". O toque abre o Início.
- **Atalhos do ícone** (tocar e segurar): Próxima aula, Notas, Mapa e Documentos ([shortcuts.xml](android/app/src/main/res/xml/shortcuts.xml)).
  - O Android abre atalhos limpando a tarefa. Por isso eles passam pela `ShortcutActivity`, sem tela, que repassa o destino à `MainActivity` pelo mesmo caminho do toque nos avisos e no widget. Com o app aberto, a tela atual fica.
  - Não há esquema de deep link público, mas a `MainActivity` é exportada: outro app pode abri-la com a mesma ação. O JS só aceita os quatro destinos.
  - O Mapa abre mesmo sem login; as outras telas esperam a conta.
  - "Notas" abre o Início no quadro de notas. Quando as notas carregam e o período não tem nenhuma, avisa que ainda não há notas.

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
- **Telas desativadas:** `disabledFeatures` marca telas do menu como indisponíveis (`notifications`, `progress`, `graduation-plan`, `schedule-generator`, `message-board`, `subjects-taken`, `curriculum-subjects`, `universal-subjects`, `subject-search`, `teacher-search` e `documents`). `notifications` também cancela os lembretes de aula e para a verificação no portal.
- **Versão mínima:** abaixo de `minSupportedVersion`, o app fica na tela de bloqueio com “Atualizar”, mesmo sem rede, porque a cópia fica salva. Só suba o valor para uma versão que já esteja em produção na Play com rollout de 100%; antes disso, parte dos usuários fica bloqueada sem ter o que instalar.
- **Endereço fixo:** o URL está embutido em todo binário publicado (`src/adapters/outbound/delivery/remoteAppStatus.ts`). Não renomeie, transfira nem apague a conta `pitroldev` ou este repositório enquanto houver versões com esse endereço em uso.
- **Pendência do responsável:** a busca já está ativa, sem depender do DSN do Sentry. Incluir o GitHub na política de privacidade e na formalização da transferência internacional da LGPD.

## Diagnóstico do portal real

Os testes comuns usam dados sintéticos e não acessam contas reais. Para o diagnóstico opcional, copie `.env.example` para `.env` e preencha `AO_MATRICULA` e `AO_PASSWORD` apenas nesse arquivo local, que é ignorado pelo Git:

```sh
pnpm diagnose:ao
pnpm diagnose:ao --expire-session
```

O script compõe o mesmo adaptador e parsers com transporte e cookies em memória no Node. O segundo comando simula perda de sessão e verifica a recuperação, inclusive de IDs derivados. A saída contém etapas, contagens e códigos de erro, sem credenciais ou HTML. Essa checagem não substitui a jornada no transporte nativo.

## Licença e atribuições

O código do projeto é distribuído sob a [GPLv3](LICENSE). Fontes, ícones, dados e marcas de terceiros conservam suas próprias condições, descritas em [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), com os textos das licenças e links de origem. A licença do código não concede direitos sobre símbolos ou marcas da UERJ e de outros titulares. O AO UERJ é um aplicativo não oficial, sem vínculo com a universidade.

## Documentação

- [Dependências: decisões, status e pendências](docs/dependencias.md)
- [Contexto de produto e design](PRODUCT.md)
- [Design system “Agenda limpa”: tokens e componentes](src/components/ui/README.md)
- [Ferramentas de desenvolvimento: conta real, deep links, capturas e E2E](scripts/dev/README.md)
- [Direção do redesenho visual](docs/design-brief.md)

Alterações no portal podem exigir atualização dos parsers. O app preserva dados já carregados e informa falhas de atualização; use o relatório em “Sobre” para descrever problemas persistentes.
