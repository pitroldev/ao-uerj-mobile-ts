# Ferramentas de desenvolvimento: modo demonstração, deep links e capturas

Tudo aqui existe **somente no build de debug** (`__DEV__`). O build de release
não contém o modo demonstração, os dados fictícios nem o scheme `aouerj-dev`.

## Modo demonstração

No login de um build de debug:

| Matrícula        | Senha  | Cenário                                                          |
| ---------------- | ------ | ---------------------------------------------------------------- |
| `demo`           | `demo` | `padrao`: período em andamento, com todos os dados               |
| `demo-rid`       | `demo` | período de inscrição: sem grade e sem notas; Início mostra o RID |
| `demo-vazio`     | `demo` | período não iniciado: sem grade, notas nem RID                   |
| `demo-bloqueado` | `demo` | Aluno Online bloqueado: leituras acadêmicas falham               |
| `demo-erro`      | `demo` | layout inesperado: leituras acadêmicas falham                    |
| `demo-lento`     | `demo` | respostas de 30 s (estados de carregamento)                      |

- Os dados ficam em `src/adapters/outbound/demo/data.ts`: a aluna fictícia
  Marina Albuquerque Teixeira, período 2026.2, notas, grade, RID, histórico,
  currículo, universais, detalhes de disciplinas, mural e gerador de grade.
- Casos de borda incluídos: sala "Não Informado" (Ética e Computação), sala
  virtual do AVA (Compiladores) e inscrição cancelada (Computação Gráfica, que
  aparece no sábado para exibir o rótulo "Cancelada"; o portal real costuma
  omitir canceladas da grade).
- O gerador de grade roda localmente; o mural guarda as mensagens só na memória
  do app; "Reportar problema" não envia nada.
- A matrícula exibida é a digitada (`demo`, `demo-rid`...), como no adaptador
  real: o cofre de credenciais exige que perfil e login tenham a mesma
  matrícula.
- Créditos eletivos vêm configurados (16/8/4); "Resetar"
  em Meu Progresso mostra o estado "Configure os créditos".
- Qualquer outra matrícula/senha segue para o Aluno Online real.
- Implementação: `src/adapters/outbound/demo/` (adaptadores e dados) e
  `src/app/composition/demoMode.ts` (roteamento entre real e demonstração).

O teclado da matrícula é numérico; `adb shell input text demo` com o campo em
foco digita normalmente. Mais simples: o deep link abaixo.

## Deep links de debug (`aouerj-dev://`)

O intent-filter fica em `android/app/src/debug/AndroidManifest.xml` e a
configuração do React Navigation em `src/app/dev/devLinking.ts`.

| Link                                | Abre                                   |
| ----------------------------------- | -------------------------------------- |
| `aouerj-dev://demo`                 | login demo (cenário `padrao`) e Início |
| `aouerj-dev://demo/<cenário>`       | login demo no cenário indicado         |
| `aouerj-dev://inicio`               | Início                                 |
| `aouerj-dev://progresso`            | Meu Progresso                          |
| `aouerj-dev://gerador`              | Gerador de Grade                       |
| `aouerj-dev://mural`                | Mural de Mensagens                     |
| `aouerj-dev://realizadas`           | Disciplinas Realizadas                 |
| `aouerj-dev://curriculo`            | Disciplinas do Currículo               |
| `aouerj-dev://universais`           | Disciplinas Universais                 |
| `aouerj-dev://pesquisa`             | Pesquisa de Disciplinas                |
| `aouerj-dev://pesquisa/IME02-10892` | detalhe de uma disciplina              |
| `aouerj-dev://sobre`                | Sobre                                  |

```sh
adb shell am start -W -a android.intent.action.VIEW -d "aouerj-dev://demo" com.aouerjmobile
adb shell am start -W -a android.intent.action.VIEW -d "aouerj-dev://progresso" com.aouerjmobile
```

As rotas só existem com uma conta conectada: entre primeiro (`aouerj-dev://demo`).
O link de login substitui a sessão atual, a menos que o mesmo cenário demo já
esteja conectado (nesse caso, só abre o Início).

## Compilar, instalar e rodar

Pré-requisitos: JDK 17+ (por exemplo, o JBR do Android Studio), Android SDK e
um emulador. Exemplo no Windows (Git Bash), com o AVD `AO_UERJ_Refactor`:

```sh
# 1. Emulador (sem janela; omita -no-window para vê-lo)
"$ANDROID_HOME/emulator/emulator" -avd AO_UERJ_Refactor -port 5554 \
  -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot-save &
adb -s emulator-5554 wait-for-device

# 2. Metro (deixe rodando em outro terminal)
pnpm start

# 3. Build de debug só para x86_64 (mais rápido) e instalação
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
ANDROID_SERIAL=emulator-5554 node scripts/gradle.cjs installDebug -PreactNativeArchitectures=x86_64
adb -s emulator-5554 reverse tcp:8081 tcp:8081
```

`pnpm android` também funciona (compila, instala e abre o Metro).

## Capturas de tela

```sh
node scripts/dev/screenshots.cjs --out <pasta> [rota | nome=caminho ...]
```

O script localiza o `adb` (`ANDROID_HOME`), escolhe o único emulador online
(ignora os "offline"; use `--serial` se houver mais de um), faz
`adb reverse tcp:8081`, garante o login demo pelo deep link, abre cada rota,
espera e salva `adb exec-out screencap -p` em `<pasta>/<nome>.png`.

Exemplos:

```sh
# todas as rotas
node scripts/dev/screenshots.cjs --out "$TEMP/aouerj-shots"

# só algumas, com nome próprio para um caminho
node scripts/dev/screenshots.cjs --out "$TEMP/aouerj-shots" inicio progresso sobre sd=pesquisa/IME02-10892

# Início no período de inscrição (RID) e com o portal bloqueado
node scripts/dev/screenshots.cjs --scenario rid --out "$TEMP/aouerj-rid" inicio
node scripts/dev/screenshots.cjs --scenario bloqueado --out "$TEMP/aouerj-bloq" inicio
```

Rotas: `inicio`, `progresso`, `gerador`, `mural`, `realizadas`, `curriculo`,
`universais`, `pesquisa`, `disciplina` (`pesquisa/IME02-10892`) e `sobre`.
Opções: `--serial`, `--scenario`, `--wait <ms>` (padrão 2500),
`--login-timeout <ms>`, `--no-login`, `--no-reverse`, `--adb`, `--help`.

## Testes E2E (Maestro)

Os fluxos ficam em `.maestro/` e usam só o modo demonstração e os deep links
acima: login, menu lateral, folhas, gerador, mural, tema, cenários do Início e
recriação da activity. No CI, rodam no workflow `E2E` (manual e noturno).

Pré-requisitos: build de debug instalado, Metro rodando e o
[Maestro CLI 2.11.0](https://github.com/mobile-dev-inc/maestro/releases/tag/cli-2.11.0)
(o `maestro.zip`, conferido com o `checksums_sha256.txt` da release). No Windows
(Git Bash), com o zip extraído em `%LOCALAPPDATA%\maestro-cli`:

```sh
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
# o Maestro chama o `adb` do PATH para listar os emuladores
export PATH="$LOCALAPPDATA/maestro-cli/maestro/bin:$ANDROID_HOME/platform-tools:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

pnpm e2e --device emulator-5554 -e API_LEVEL=35 --test-output-dir "$TEMP/aouerj-e2e"
maestro test .maestro/05-mural.yaml --device emulator-5554   # um fluxo só
```

- `API_LEVEL` (opcional) liga a conferência da cópia no mural: do Android 13
  em diante, quem confirma a cópia é o sistema, e não um aviso do app.
- Para os fluxos não esperarem o `10.0.2.2` do emulador, que pode travar no meio
  do bundle, e o Fast Refresh não recarregar o app no meio de um fluxo: menu de
  desenvolvimento > "Change Bundle Location" > `localhost:8081` (com
  `adb reverse tcp:8081 tcp:8081`) e "Disable Fast Refresh". O
  `scripts/dev/e2e-ci.sh` faz o mesmo no CI.
- Com um emulador `offline` na lista do `adb devices`, o Maestro 2.11 não acha
  nenhum aparelho ("Device with id ... is not connected"). Feche esse emulador
  ou conecte direto na porta adb do seu (a do console + 1):
  `maestro --host localhost --port 5555 test .maestro`.
- A recriação pela fonte do sistema roda em duas etapas, com o adb no meio:
  `maestro test .maestro/recriacao/1-abrir-conversa.yaml`, depois
  `adb shell settings put system font_scale 1.3` e
  `maestro test .maestro/recriacao/2-conferir.yaml` (volte a fonte para `1.0`).

No iOS, execute os fluxos em `.maestro/ios/` num simulador dedicado. O fluxo de
login limpa também o Keychain para que uma nova tentativa comece desconectada.
Antes dos testes, desative o preenchimento de senhas nesse simulador, como faz
o CI:

```sh
xcrun simctl spawn "$SIM_UDID" defaults write com.apple.WebUI AutoFillPasswords -int 0
maestro --device "$SIM_UDID" test .maestro/ios/01-login-inicio.yaml
```

É a [mesma preferência usada pelo Appium](https://github.com/appium/appium-ios-simulator/blob/master/lib/extensions/settings.ts).
O alerta “Save Password?” pode aparecer depois do login sem ser exposto pelo
driver do Maestro ([problema upstream](https://github.com/mobile-dev-inc/Maestro/issues/3277)).
A configuração vale só para o simulador; o app continua oferecendo autofill.
Os fluxos continuam exigindo Início, menu e dados da conta de demonstração.

## Limitações

- O relógio é o do emulador: "próxima aula", o dia selecionado na semana e
  as datas relativas mudam com a hora real (o protótipo congela terça,
  13/10/2026, 11:58). Para reproduzir a referência, ajuste data, hora e fuso do
  emulador (Configurações > Sistema > Data e hora).
- Estados que dependem de rede ou de cache (sem conexão, atualizando, falha ao
  atualizar com dados salvos) não têm cenário próprio: use o modo avião do
  emulador com dados já carregados.
- Sheets, menu lateral e passos internos do gerador não têm deep link; abra-os
  pela interface depois de navegar até a tela.
