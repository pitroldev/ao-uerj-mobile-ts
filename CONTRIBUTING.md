# Como contribuir

Que bom que você chegou! O AO UERJ é feito por alunos da UERJ para alunos da UERJ, e toda ajuda conta: um texto mais claro, um teste, um bug bem relatado ou uma tela nova. Você não precisa ter experiência com React Native para começar. Issues e PRs podem ser em português.

> [!IMPORTANT]
> **Privacidade em primeiro lugar.** Este repositório é público. Nunca commite nem cole em issues e PRs a sua matrícula, senha, notas, nome de colegas, páginas do portal ou capturas de tela com dados pessoais. As [regras de privacidade](#privacidade) valem para tudo o que você mandar.

## Índice

- [Jeitos de ajudar](#jeitos-de-ajudar)
- [Primeira contribuição](#primeira-contribuição)
- [Preparar o ambiente](#preparar-o-ambiente)
- [Rodar no Android](#rodar-no-android)
- [Rodar o servidor](#rodar-o-servidor)
- [Verificações](#verificações)
- [Fluxo de branch e PR](#fluxo-de-branch-e-pr)
- [Commits](#commits)
- [Convenções de código](#convenções-de-código)
- [Textos do app](#textos-do-app)
- [Privacidade](#privacidade)
- [Reportar bugs com segurança](#reportar-bugs-com-segurança)
- [Onde perguntar](#onde-perguntar)

## Jeitos de ajudar

| Sem programar                                             | Programando                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| Relatar um bug com os passos para reproduzir              | Corrigir um bug ou um parser que quebrou com uma mudança do portal  |
| Sugerir uma melhoria ou dizer o que falta no Aluno Online | Escrever testes para as regras acadêmicas                           |
| Revisar os textos do app: estão claros para um calouro?   | Melhorar a acessibilidade (leitor de tela, fonte grande, contraste) |
| Testar uma versão nova no seu celular                     | Criar uma funcionalidade nova, combinada antes numa issue           |

## Primeira contribuição

Algumas portas de entrada boas:

- **Issues com `good first issue`** na [lista de issues](https://github.com/pitroldev/ao-uerj-mobile-ts/issues).
- **Regras do domínio** (`src/modules/*/domain`): funções puras, sem React nem rede, fáceis de entender e de testar. Por exemplo, a conta da PF em `src/modules/academics/domain/rules/finalExam.ts`.
- **Parsers do portal** (`src/adapters/outbound/aluno-online/parsers`): cada um lê uma página. Os testes usam páginas inventadas em `__fixtures__/`.
- **Textos e acessibilidade:** rótulos para o leitor de tela, mensagens de erro e de estado vazio mais claras.
- **Design system** (`src/components/ui`): componentes pequenos, com regras escritas no [README dele](src/components/ui/README.md).
- **Servidor** (`server/`): os casos de uso rodam com repositórios em memória, sem banco.
- **Documentação:** achou algo confuso aqui? Corrigir já é uma contribuição.

Antes de começar algo grande, abra uma issue contando a ideia. Assim ninguém faz o mesmo trabalho duas vezes, e dá para combinar o caminho antes.

## Preparar o ambiente

### Pré-requisitos

|          | Windows                                                                              | Linux       | macOS                           |
| -------- | ------------------------------------------------------------------------------------ | ----------- | ------------------------------- |
| Terminal | Git Bash                                                                             | o de sempre | o de sempre                     |
| Node     | 22.21.1 (`.node-version`)                                                            | 22.21.1     | 22.21.1                         |
| pnpm     | 12.11.2, pelo Corepack 0.34.5+                                                       | igual       | igual                           |
| Android  | JDK 17 e Android Studio (SDK 37, Build Tools 37.0.0, NDK 27.1.12297006, um emulador) | igual       | igual                           |
| iOS      | não compila                                                                          | não compila | Xcode, Ruby/Bundler e CocoaPods |

- O projeto aceita o Node ^22.13.0, ^24.3.0 ou >=26.0.0, mas use o do `.node-version` para ficar igual ao CI. Qualquer gerenciador de versões do Node serve.
- O JDK que vem com o Android Studio serve (no Windows, em geral `C:/Program Files/Android/Android Studio/jbr`).
- Sem Mac, o iPhone é conferido pelo workflow manual `ios.yml`; ver [iOS](docs/ios.md).
- Todos os detalhes das versões estão em [Desenvolvimento](docs/desenvolvimento.md#versões).

### Passo a passo

1. **Faça um fork** de [pitroldev/ao-uerj-mobile-ts](https://github.com/pitroldev/ao-uerj-mobile-ts) e clone o seu:

   ```sh
   git clone https://github.com/<seu-usuário>/ao-uerj-mobile-ts.git
   cd ao-uerj-mobile-ts
   git remote add upstream https://github.com/pitroldev/ao-uerj-mobile-ts.git
   ```

2. **Ative o pnpm** pelo Corepack (a versão sai do campo `packageManager`):

   ```sh
   npm install -g corepack@latest
   corepack enable
   ```

   Se preferir não usar o Corepack, troque o `pnpm install` abaixo por `npx --yes pnpm@12.11.2 install --frozen-lockfile`.

3. **Instale as dependências:**

   ```sh
   pnpm install --frozen-lockfile
   ```

   Isso instala o app, o servidor (`server/`, pelo `postinstall`) e os hooks do Git (lefthook).

4. **Aponte o Android:** defina `JAVA_HOME` para o JDK 17 e `ANDROID_HOME` para o SDK. O SDK também pode ir em `android/local.properties` (arquivo local, fora do Git).

   ```sh
   # Git Bash, por exemplo:
   export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
   export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
   ```

## Rodar no Android

Abra um emulador (ou ligue um celular com a depuração USB) e:

```sh
pnpm start      # o Metro, num terminal
pnpm android    # em outro: compila, instala e abre o app
```

- **Login:** entre com a sua própria conta do Aluno Online. O app lê o portal real e não tem conta de demonstração. Os seus dados ficam só no emulador.
- **Build mais rápido:** `pnpm build:debug -PreactNativeArchitectures=x86_64` compila só a arquitetura do emulador.
- **Funções entre alunos:** num build de debug, o servidor de produção não reconhece o app (a Play Integrity só aprova o app instalado pela loja), então o mural, a busca de docentes, a Companhia agora e o Agora no campus não entram como aluno. Para trabalhar nelas, use os testes: o teste de contrato roda os adaptadores do app contra o servidor de verdade, com uma atestação de desenvolvimento.
- **Ferramentas:** login automático com a conta do `.env`, deep links de debug (`aouerj-dev://`), capturas e E2E estão em [scripts/dev/README.md](scripts/dev/README.md).

## Rodar o servidor

O app sempre fala com `https://pitrol.dev`. Rodar o servidor na sua máquina serve para mexer no próprio servidor.

```sh
pnpm test:server                      # os testes, sem banco instalado
cp server/.env.example server/.env    # ajuste o MONGODB_URI
pnpm server dev                       # node --watch src/main.ts
```

- Os testes sobem um mongod próprio (`mongodb-memory-server`). A primeira execução baixa o binário: uns 100 MB no Linux e 800 MB no Windows.
- O `pnpm server dev` precisa de um MongoDB de verdade no `MONGODB_URI`.
- A API, a arquitetura e a implantação estão em [server/README.md](server/README.md).

## Verificações

| Comando             | O que pega                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`         | Erros comuns, regras que usam os tipos e imports que furam as camadas da arquitetura. Falha com qualquer aviso |
| `pnpm format:check` | Formatação fora do Prettier. `pnpm format` corrige                                                             |
| `pnpm type-check`   | Erros de tipo no app, no servidor e no contrato entre os dois                                                  |
| `pnpm knip`         | Dependências, arquivos e exports sem uso                                                                       |
| `pnpm test:ci`      | Os testes do Jest, em série, como no CI, inclusive o teste de contrato com o servidor                          |
| `pnpm test:tooling` | Os testes dos scripts: Gradle, projeto iOS, endereço da política de privacidade, arquitetura e outros          |
| `pnpm test:server`  | Os testes do servidor (quando você mexe em `server/`)                                                          |

O CI (workflow Quality) roda tudo isso em cada PR, mais o build debug e o AAB de release. Os detalhes estão em [Desenvolvimento](docs/desenvolvimento.md#verificações).

> [!TIP]
> Com pouca memória livre, o `pnpm test:ci` já roda em série. Se o `pnpm knip` falhar com `RangeError: Array buffer allocation failed`, rode `KNIP_DISABLE_RAW_TRANSFER=1 pnpm knip`.

### Hooks do Git

O `pnpm install` instala os hooks do lefthook (`lefthook.yml`):

- **pre-commit:** Oxlint e Prettier nos arquivos staged;
- **pre-push:** `pnpm type-check`.

Se um hook falhar, corrija o problema em vez de pular o hook.

## Fluxo de branch e PR

1. Atualize a sua `main` com a do projeto:

   ```sh
   git fetch upstream
   git switch main
   git merge --ff-only upstream/main
   ```

2. Crie um branch com um nome curto: `git switch -c fix/pf-sem-p2`.
3. Faça a mudança, com testes, e rode as [verificações](#verificações).
4. Envie para o seu fork e abra o PR para a `main` de `pitroldev/ao-uerj-mobile-ts`. O modelo do PR traz a lista do que conferir.
5. Na primeira vez, o CI de um PR de fork pode esperar a aprovação de quem mantém o projeto.

Não mexa na versão nem no `CHANGELOG.md`: quem publica faz isso na hora da release (ver [Release](docs/release.md)).

### Antes de pedir revisão

- [ ] As verificações passam.
- [ ] O que mudou tem teste novo ou atualizado.
- [ ] Os textos novos seguem as [regras dos textos](#textos-do-app).
- [ ] Nenhum dado pessoal real no código, nos testes, nas capturas ou na descrição do PR.
- [ ] Se muda o que o app guarda ou envia, [Dados e armazenamento](docs/dados-e-armazenamento.md) e a [política de privacidade](docs/privacidade.md) foram atualizados.
- [ ] A documentação de `docs/` acompanha a mudança.

## Commits

O projeto usa [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com o assunto **em inglês**, curto, em minúsculas e sem ponto final, dizendo o que muda para quem usa, e o escopo do módulo ou da área:

```text
feat(companion): invite on the Início, heads-up when someone opens, and fewer half-empty tables
fix(progress): count the official complementary hours of the Síntese
docs(privacy): the iPhone and App Attest in the policy and the privacy manifest
test(parsers): add tests for subject parsing and handling various row formats
ci(ios): sign the simulator build to run locally
```

(Exemplos reais do `git log`.)

- **Tipos:** `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore` e `revert`.
- **Escopos comuns:** `server`, `android`, `ios`, `companion`, `campus`, `home`, `widget`, `graduation`, `delivery`, `notifications`, `parsers`, `e2e`, `deploy`.
- **Nomes do app** ficam em português, como aparecem na tela: Início, Companhia agora, mural.
- **Corpo:** opcional, em inglês, dizendo o que muda e por quê.
- Nenhum hook confere a mensagem, mas o release-please lê os prefixos: `feat` e `fix` viram as seções "Novidades" e "Correções" do `CHANGELOG.md` e decidem a próxima versão.

## Convenções de código

- **Idiomas:** comentários em português; títulos dos testes (`it`, `test`, `describe`) em inglês; identificadores em inglês; textos da interface em português.
- **Camadas:** o domínio e os casos de uso dependem só de portas. React, React Native, axios, cheerio, TanStack Query e os adaptadores ficam fora de `domain/` e `application/`, e o `pnpm lint` acusa. As regras estão em [Arquitetura](docs/arquitetura.md#fronteiras-que-o-oxlint-guarda).
- **HTML do portal:** use `loadHtml()` de `src/adapters/outbound/aluno-online/html.ts`, nunca a raiz do `cheerio` (quebra no Metro).
- **Avisos na tela:** use a fachada `snackbar` de `@components/ui`, não o `react-native-toast-message` direto.
- **Design system "Agenda limpa":** monte as telas com as primitivas de `@components/ui` e os tokens do tema. Em resumo, do [README dele](src/components/ui/README.md):
  - alvos de toque de 48 dp;
  - status nunca só por cor (ponto e rótulo, ícone e texto);
  - respeite a fonte do sistema: nada de desligar `allowFontScaling`, e `minHeight` em vez de `height` em caixas com texto;
  - peso pela família (`<Text weight="semibold">`), nunca `fontWeight`;
  - nada de cor, fonte ou tamanho literal fora de `src/themes`, nem estilo inline com valores fixos;
  - movimento de 150 a 250 ms, só para mostrar estado, respeitando "remover animações".
- **Estados de tela:** toda tela de dados tem carregando, vazio, erro com nova tentativa, portal bloqueado, sem conexão com dados salvos e atualizando.
- **Honestidade:** o CR do app é aproximado e nunca aparece como oficial. Não invente dados.
- **Testes:** regras com testes de unidade (`*.test.ts`); componentes com a Testing Library (`*.test.tsx`); parsers com páginas inventadas em `__fixtures__/`.
- **Telas:** confira entre 320 e 390 dp, com fonte ampliada, nomes longos, teclado aberto e tema escuro (ver as [diretrizes visuais](docs/design-brief.md)).

## Textos do app

O público são calouros e alunos jovens de graduação. Cada texto deve soar como um aluno falaria.

- **Simples e curto:** frases curtas, palavras do dia a dia, sem jargão de produto ("janela", "densidade", "fluxo").
- **Pelo que a pessoa faz:** "Abrir mesa", "Entrar no grupo", e não o nome do modelo no código (`Call`).
- **Nunca "chamada":** na faculdade, chamada é a lista de presença. Na Companhia agora, no almoço é "mesa" ("Abrir mesa", "Sentar junto"); na saída, "grupo para voltar" ("Abrir grupo", "Entrar no grupo"). Quem cria é "quem abriu".
- **A língua da UERJ fica como é:** tempos M1–M6, T1–T6 e N1–N5; períodos como 2025.1; P1, P2, PF e Média; RID parcial; Obrigatória, Eletiva Restrita, Eletiva Definida e Universal; códigos como IME02-01388.
- **"Funcionalidades exclusivas":** a folha (`src/features/AppInfoModal/info.ts`) só lista o que o app faz além do Aluno Online.

## Privacidade

O app lida com dados de alunos de verdade. Estas regras valem para todo código, teste, issue e PR:

- **Nada de dado real no Git:** matrícula, nome, notas, CR, grade, páginas do portal (HTML), PDFs, capturas e gravações de tela, relatórios do Maestro. Nem "só para testar".
- **Fixtures inventadas:** as páginas de teste em `src/adapters/outbound/aluno-online/__fixtures__/` são sintéticas. Se você partir de uma página real, troque tudo: nomes, matrículas, notas, códigos e datas.
- **O `.env` é só seu:** `AO_MATRICULA` e `AO_PASSWORD` servem ao diagnóstico opcional do portal real (`pnpm diagnose:ao`, ver [Desenvolvimento](docs/desenvolvimento.md#diagnóstico-do-portal-real)) e às ferramentas de `scripts/dev`. O arquivo é ignorado pelo Git; nunca o commite nem cole o conteúdo dele. Use só a sua conta.
- **Sem log de dados:** não registre credenciais, cookies, tokens nem HTML do portal, nem em `console.log`.
- **Mudou o que sai do aparelho?** Toda mudança no que o app guarda ou envia entra em [Dados e armazenamento](docs/dados-e-armazenamento.md) e na [política de privacidade](docs/privacidade.md), com a data do topo. Avise no PR: quem mantém atualiza o formulário da Play Console. A política fica sempre em `docs/privacidade.md`, porque a Play e o app apontam para esse endereço.
- **Sem rastreamento:** o app não usa ferramentas de análise nem de anúncios. Uma biblioteca nova que mande dados para terceiros precisa de conversa numa issue antes.
- **Capturas nos PRs:** só com os dados pessoais escondidos (nome, matrícula, notas). Prefira telas sem dados, como o Mapa, o Sobre ou o Login.

## Reportar bugs com segurança

- **Pelo app:** em **Sobre > Reportar problema**. O relato leva um diagnóstico técnico sem a sua senha nem as páginas do portal. É o melhor caminho quando uma tela que lê o Aluno Online quebra.
- **Pelo GitHub:** abra uma [issue de problema](https://github.com/pitroldev/ao-uerj-mobile-ts/issues/new/choose). O formulário pede a versão do app (em Sobre), o aparelho, o sistema e os passos. Não cole matrícula, senha, notas nem capturas com dados pessoais.
- **Falha de segurança:** não abra issue pública. Escreva para **contato@pitrol.dev**.
- **Seus dados:** pedidos de acesso, correção ou exclusão seguem a [política de privacidade](docs/privacidade.md#seus-direitos).

## Onde perguntar

Abra uma issue de dúvida pelo [formulário](https://github.com/pitroldev/ao-uerj-mobile-ts/issues/new/choose) ou comente na issue em que você está trabalhando. Não existe pergunta boba: se algo aqui não ficou claro, a documentação é que precisa melhorar.
