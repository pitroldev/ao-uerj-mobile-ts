# Ferramentas de desenvolvimento: conta real, navegação e capturas

Os deep links `aouerj-dev://` existem somente no build Android de debug e
servem para navegar depois da autenticação. O app usa o Aluno Online real.

## Entrar com a conta do .env

Configure `AO_MATRICULA` e `AO_PASSWORD` no `.env` local, que não deve ser
versionado. O helper também aceita essas variáveis no ambiente, com prioridade
sobre o arquivo, para execução em CI.

```sh
node scripts/dev/login.cjs --serial emulator-5554
```

O helper abre o formulário normal do app, preenche Matrícula e Senha e confere
no menu que a sessão pertence à matrícula configurada. Se outra conta estiver
conectada, usa o botão Sair antes de autenticar. Nenhum login alternativo é
adicionado ao aplicativo.

Se a mesma conta já estiver conectada, o helper reutiliza a sessão e confere a
matrícula exibida. Isso não revalida a senha nem comprova comunicação atual com
o portal: a sessão pode ter sido restaurada do armazenamento local. Para
comprovar a integração online, faça uma nova autenticação pelo formulário e
conclua uma operação que consulte o Aluno Online, como obter um PDF existente.

As credenciais ficam em memória e seguem pelo stdin do adb, sem aparecer na
linha de comando, no deep link ou em arquivos temporários. A hierarquia da UI
é lida em memória; o helper não captura telas nem registra os dados da conta.
O preenchimento por adb aceita caracteres ASCII imprimíveis. Para outra senha,
entre manualmente e use `--no-login` nas capturas.

Opções: `--adb <caminho>`, `--serial <id>`, `--env-file <arquivo>` e
`--login-timeout <ms>` (padrão 180000).

## Deep links de debug

O intent-filter fica em `android/app/src/debug/AndroidManifest.xml` e a
configuração do React Navigation em `src/app/dev/devLinking.ts`.

| Link                                | Abre                                  |
| ----------------------------------- | ------------------------------------- |
| `aouerj-dev://inicio`               | Início                                |
| `aouerj-dev://mapa`                 | Mapa do campus                        |
| `aouerj-dev://progresso`            | Meu Progresso                         |
| `aouerj-dev://plano`                | Plano até a formatura                 |
| `aouerj-dev://documentos`           | Emissão de Documentos                 |
| `aouerj-dev://gerador`              | Gerador de Grade, quando habilitado   |
| `aouerj-dev://mural`                | Mural de Mensagens, quando habilitado |
| `aouerj-dev://realizadas`           | Disciplinas Realizadas                |
| `aouerj-dev://curriculo`            | Disciplinas do Currículo              |
| `aouerj-dev://universais`           | Disciplinas Universais                |
| `aouerj-dev://pesquisa`             | Pesquisa de Disciplinas               |
| `aouerj-dev://pesquisa/IME02-10892` | Detalhe de uma disciplina             |
| `aouerj-dev://notificacoes`         | Notificações                          |
| `aouerj-dev://sobre`                | Sobre                                 |

```sh
adb shell am start -W -a android.intent.action.VIEW -d "aouerj-dev://documentos" com.aouerjmobile
```

As rotas privadas exigem uma sessão autenticada. O link não recebe credenciais,
não autentica e não altera a conta conectada.

## Compilar, instalar e rodar

Pré-requisitos: JDK 17+, Android SDK e um emulador. Exemplo no Windows (Git Bash):

```sh
"$ANDROID_HOME/emulator/emulator" -avd AO_UERJ_Refactor -port 5554 \
  -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot-save &
adb -s emulator-5554 wait-for-device

# Em outro terminal
pnpm start

export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
ANDROID_SERIAL=emulator-5554 node scripts/gradle.cjs installDebug -PreactNativeArchitectures=x86_64
adb -s emulator-5554 reverse tcp:8081 tcp:8081
node scripts/dev/login.cjs --serial emulator-5554
```

`pnpm android` também compila, instala e abre o Metro.

## Capturas de tela

```sh
node scripts/dev/screenshots.cjs --out <pasta> [rota | nome=caminho ...]
```

O script localiza o adb (`ANDROID_HOME`), escolhe o único emulador online,
configura `adb reverse tcp:8081`, confere a conta configurada (autenticando pelo
formulário quando necessário) e abre as
rotas solicitadas. As imagens contêm os dados reais exibidos pelo aplicativo;
mantenha a pasta de saída local e fora de commits e artifacts públicos.

```sh
node scripts/dev/screenshots.cjs --out "$TEMP/aouerj-shots" documentos sobre
node scripts/dev/screenshots.cjs --no-login --out "$TEMP/aouerj-shots" inicio progresso
node scripts/dev/screenshots.cjs --out "$TEMP/aouerj-shots" sd=pesquisa/IME02-10892
```

Rotas: `inicio`, `mapa`, `progresso`, `plano`, `documentos`, `gerador`, `mural`, `realizadas`,
`curriculo`, `universais`, `pesquisa`, `disciplina`, `notificacoes` (Android) e `sobre`. Sem rotas explícitas,
o script captura todas as rotas listadas. Funcionalidades desativadas continuam
sujeitas à configuração efetiva do app.

Opções: `--serial`, `--wait <ms>` (padrão 2500), `--login-timeout <ms>`,
`--no-login`, `--no-reverse`, `--adb` e `--help`. `--no-login` usa a sessão já
aberta e não lê as credenciais.

Os atalhos do ícone e o toque nos avisos e no widget abrem o app pela ação
`com.aouerjmobile.notifications.OPEN` (ver `AppLaunch.kt`), e não pelo deep link
de desenvolvimento. Para testar um destino com o app aberto ou fechado:

```sh
adb shell am start -n com.aouerjmobile/.MainActivity \n  -a com.aouerjmobile.notifications.OPEN \n  --es com.aouerjmobile.notifications.TARGET grades
```

Os destinos são `home`, `grades`, `map` e `documents`.

## Testes E2E (Maestro)

Os fluxos de `.maestro/` usam uma sessão real previamente autenticada. Faça o
login com o helper antes de iniciar o Maestro, para que credenciais não entrem
em YAML, argumentos ou relatórios. Os fluxos verificam navegação e leituras;
não emitem nem excluem documentos e não enviam mensagens.

Os fluxos rolam até os controles antes de usá-los. Isso mantém a verificação de
navegação, da folha de relato e da recriação da activity em telas de 360 dp e
com fonte ampliada, mesmo quando as ações de Sobre ficam abaixo da dobra.

Pré-requisitos: build de debug instalado, Metro e Maestro CLI 2.11.0.

```sh
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export PATH="$LOCALAPPDATA/maestro-cli/maestro/bin:$ANDROID_HOME/platform-tools:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
node scripts/dev/login.cjs --serial emulator-5554
maestro --host localhost --port 5555 test .maestro --test-output-dir "$TEMP/aouerj-e2e"
maestro --host localhost --port 5555 test .maestro/10-documentos.yaml
```

Os relatórios do Maestro podem conter dados da conta. Não os publique. O
workflow `E2E` é somente manual e exige a opção `run_real_account` e os secrets
`AO_MATRICULA`/`AO_PASSWORD`. Não há execução agendada, execução de PR nem upload
automático das capturas. O workflow não executa iOS.

Para evitar espera no `10.0.2.2`, configure no menu de desenvolvimento
`Change Bundle Location` como `localhost:8081`, com `adb reverse` ativo, e
`Disable Fast Refresh`. O script `scripts/dev/e2e-ci.sh` configura isso no CI.
Com emuladores offline na lista, conecte o Maestro diretamente à porta adb do
emulador ativo (porta do console + 1), como nos exemplos acima.

## Limitações

- Os dados e a disponibilidade dependem da conta e do portal reais.
- O relógio do emulador determina a próxima aula e as datas relativas.
- Para verificar comportamento offline, carregue os dados reais antes de
  ativar o modo avião. Não há cenários artificiais no aplicativo.
- Folhas, menu e passos internos de funcionalidades são acessados pela UI.
